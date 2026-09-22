import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import type { SkillTestCase, SkillVersion } from '../../../app/domain/index.ts';
import {
  createClaudeEnvironment,
  getClaudeReadiness,
} from '../../../app/backend/platform/claude-readiness.ts';
import {
  SkillTestRunner,
  type SkillRunnerChild,
  type SkillRunnerFileSystem,
  type SkillRunnerSpawn,
} from '../../../app/backend/testing/skill-runner.ts';

const NOW = new Date('2026-09-22T12:00:00.000Z');

function version(): SkillVersion {
  return {
    id: 'version-1',
    skillId: 'skill-1',
    revision: 'revision-1',
    label: 'Draft',
    createdAt: NOW.toISOString(),
    source: 'draft',
    files: [
      {
        path: 'SKILL.md',
        content: '---\nname: original-name\ndescription: Test\n---\n\nSecret source content.',
        mode: 0o644,
      },
      { path: 'references/example.md', content: 'Reference', mode: 0o600 },
    ],
  };
}

function testCase(): SkillTestCase {
  return {
    id: 'case-1',
    skillId: 'skill-1',
    name: 'Expected output',
    prompt: 'Stored case prompt',
    expectedContains: ['answer'],
    expectedExcludes: ['forbidden'],
    createdAt: NOW.toISOString(),
  };
}

class FakeChild extends EventEmitter implements SkillRunnerChild {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly input: string[] = [];
  readonly signals: NodeJS.Signals[] = [];
  readonly stdin = {
    end: (data: string) => {
      this.input.push(data);
    },
  };

  constructor(readonly pid: number) {
    super();
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.signals.push(signal);
    return true;
  }

  close(exitCode: number | null): void {
    this.emit('close', exitCode, null);
  }
}

function fakeFileSystem() {
  const writes: {
    projectDirectory: string;
    commandName: string;
    relativePath: string;
    content: string;
    mode: number;
  }[] = [];
  const cleaned: string[] = [];
  let project = 0;
  const fileSystem: SkillRunnerFileSystem = {
    async createTempProject() {
      project += 1;
      return `/fake/project-${project}`;
    },
    async writeSkillFile(projectDirectory, commandName, relativePath, content, mode) {
      writes.push({ projectDirectory, commandName, relativePath, content, mode });
    },
    async cleanup(projectDirectory) {
      cleaned.push(projectDirectory);
    },
  };
  return { fileSystem, writes, cleaned };
}

function harness(
  options: {
    concurrency?: number;
    timeoutMs?: number;
    killGraceMs?: number;
    testCase?: SkillTestCase;
    closeOnTerm?: boolean;
  } = {},
) {
  const children: FakeChild[] = [];
  const invocations: {
    command: string;
    args: readonly string[];
    options: Parameters<SkillRunnerSpawn>[2];
  }[] = [];
  const files = fakeFileSystem();
  let nextPid = 100;
  let nextId = 0;
  const spawn: SkillRunnerSpawn = (command, args, spawnOptions) => {
    const child = new FakeChild(nextPid);
    nextPid += 1;
    children.push(child);
    invocations.push({ command, args, options: spawnOptions });
    return child;
  };
  const groupSignals: { pid: number; signal: NodeJS.Signals }[] = [];
  const runner = new SkillTestRunner({
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
    killGraceMs: options.killGraceMs,
    spawn,
    fileSystem: files.fileSystem,
    environment: {
      PATH: '/bin',
      HOME: '/safe-home',
      ANTHROPIC_API_KEY: 'credential',
      UNRELATED_SECRET: 'must-not-pass',
    },
    now: () => NOW,
    createId: () => `id-${nextId++}`,
    signalProcessGroup(pid, signal) {
      groupSignals.push({ pid, signal });
      const child = children.find((candidate) => candidate.pid === pid);
      child?.signals.push(signal);
      if (signal === 'SIGTERM' && options.closeOnTerm !== false) {
        queueMicrotask(() => child?.close(null));
      }
    },
  });

  return { runner, children, invocations, groupSignals, ...files };
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Condition was not reached');
}

function emitResult(
  child: FakeChild,
  result = 'the answer',
  extra: Record<string, unknown> = {},
): void {
  child.stdout.write(
    `${JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: result } },
    })}\n`,
  );
  child.stdout.write(
    `${JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result,
      usage: { input_tokens: 12, output_tokens: 4 },
      total_cost_usd: 0.01,
      ...extra,
    })}\n`,
  );
}

describe('SkillTestRunner', () => {
  it('validates per-run turn and timeout bounds', () => {
    const setup = harness();
    expect(() =>
      setup.runner.launch({
        skill: version(),
        prompt: 'Prompt',
        model: 'sonnet',
        settings: { maxTurns: 21, timeoutSeconds: 60 },
      }),
    ).toThrow('Turn limit must be between 1 and 20');
    expect(() =>
      setup.runner.launch({
        skill: version(),
        prompt: 'Prompt',
        model: 'sonnet',
        settings: { maxTurns: 4, timeoutSeconds: 301 },
      }),
    ).toThrow('Timeout must be between 1 and 300 seconds');
  });

  it('rejects package path traversal before creating a temporary project', () => {
    const setup = harness();
    const source = version();
    source.files.push({ path: '../outside.md', content: 'unsafe', mode: 0o600 });

    expect(() => setup.runner.launch({ skill: source, prompt: 'Prompt', model: 'sonnet' })).toThrow(
      'Skill files must use normalized relative paths',
    );
    expect(setup.children).toHaveLength(0);
    expect(setup.writes).toHaveLength(0);
  });

  it('runs a copied, renamed skill with bounded isolated Claude arguments', async () => {
    const source = version();
    const persisted = vi.fn();
    const setup = harness();
    const runner = new SkillTestRunner({
      spawn: setup.invocations.length
        ? undefined
        : (command, args, options) => {
            const child = new FakeChild(200);
            setup.children.push(child);
            setup.invocations.push({ command, args, options });
            return child;
          },
      fileSystem: setup.fileSystem,
      environment: {
        PATH: '/bin',
        HOME: '/safe-home',
        ANTHROPIC_API_KEY: 'credential',
        UNRELATED_SECRET: 'must-not-pass',
      },
      persist: persisted,
      now: () => NOW,
      createId: (() => {
        let id = 0;
        return () => `run-${id++}`;
      })(),
    });
    const launched = runner.launch({
      skill: source,
      prompt: 'Explain this skill',
      model: 'sonnet',
      testCase: testCase(),
    });

    await waitFor(() => setup.children.length === 1);
    const child = setup.children[0];
    emitResult(child);
    child.close(0);
    await waitFor(() => runner.get(launched.id)?.run.status === 'passed');

    const snapshot = runner.get(launched.id);
    expect(snapshot?.run).toMatchObject({
      skillId: 'skill-1',
      versionId: 'version-1',
      status: 'passed',
      output: 'the answer',
      exitCode: 0,
      usage: { inputTokens: 12, outputTokens: 4, costUsd: 0.01 },
    });
    expect(snapshot?.run.assertions).toEqual([
      { label: 'Output contains "answer"', passed: true },
      { label: 'Output excludes "forbidden"', passed: true },
    ]);
    expect(setup.invocations[0].command).toBe('claude');
    expect(setup.invocations[0].args).toEqual(
      expect.arrayContaining([
        '-p',
        '--output-format',
        'stream-json',
        '--include-partial-messages',
        '--no-session-persistence',
        '--strict-mcp-config',
        '--permission-mode',
        'dontAsk',
        '--max-budget-usd',
        '0.25',
      ]),
    );
    expect(setup.invocations[0].args).not.toContain('Explain this skill');
    expect(child.input[0]).toMatch(/^\/skill-test-run-0 Explain this skill$/);
    expect(setup.invocations[0].options.env).toEqual({
      PATH: '/bin',
      HOME: '/safe-home',
      ANTHROPIC_API_KEY: 'credential',
    });
    expect(setup.writes[0].content).toContain('name: skill-test-run-0');
    expect(source.files[0].content).toContain('name: original-name');
    expect(setup.cleaned).toEqual(['/fake/project-1']);
    expect(persisted).toHaveBeenCalledWith(expect.objectContaining({ status: 'passed' }));
  });

  it('runs no more than two tests and advances the queue', async () => {
    const setup = harness({ concurrency: 2 });
    const runs = [1, 2, 3].map((number) =>
      setup.runner.launch({
        skill: version(),
        prompt: `Prompt ${number}`,
        model: 'sonnet',
      }),
    );

    await waitFor(() => setup.children.length === 2);
    expect(setup.runner.get(runs[2].id)?.run.status).toBe('queued');
    emitResult(setup.children[0]);
    setup.children[0].close(0);
    await waitFor(() => setup.children.length === 3);
    expect(setup.runner.get(runs[2].id)?.run.status).toBe('running');

    for (const child of setup.children.slice(1)) {
      emitResult(child);
      child.close(0);
    }
    await waitFor(() => runs.every((run) => setup.runner.get(run.id)?.run.status === 'passed'));
  });

  it('warns on malformed lines but accepts a later valid result', async () => {
    const setup = harness();
    const run = setup.runner.launch({ skill: version(), prompt: 'Prompt', model: 'sonnet' });
    await waitFor(() => setup.children.length === 1);
    setup.children[0].stdout.write('not-json\n');
    emitResult(setup.children[0]);
    setup.children[0].close(0);
    await waitFor(() => setup.runner.get(run.id)?.run.status === 'passed');

    expect(setup.runner.get(run.id)?.traces).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        message: 'Claude emitted an unrecognized stream event.',
      }),
    );
  });

  it('fails nonzero exits and zero exits without a result event', async () => {
    const setup = harness();
    const nonzero = setup.runner.launch({
      skill: version(),
      prompt: 'Prompt one',
      model: 'sonnet',
    });
    await waitFor(() => setup.children.length === 1);
    setup.children[0].close(2);
    await waitFor(() => setup.runner.get(nonzero.id)?.run.status === 'failed');

    const missingResult = setup.runner.launch({
      skill: version(),
      prompt: 'Prompt two',
      model: 'sonnet',
    });
    await waitFor(() => setup.children.length === 2);
    setup.children[1].close(0);
    await waitFor(() => setup.runner.get(missingResult.id)?.run.status === 'failed');
    expect(setup.runner.get(missingResult.id)?.traces).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        message: 'Claude exited without a valid result event.',
      }),
    );
  });

  it('times out one process group and cleans up its project', async () => {
    const setup = harness({ timeoutMs: 10, killGraceMs: 5 });
    const first = setup.runner.launch({ skill: version(), prompt: 'One', model: 'sonnet' });
    await waitFor(() => setup.children.length === 1);

    await waitFor(() => setup.runner.get(first.id)?.run.status === 'timed-out');
    expect(setup.groupSignals[0]).toEqual({ pid: setup.children[0].pid, signal: 'SIGTERM' });
    expect(setup.cleaned).toContain('/fake/project-1');
  });

  it('cancels only the selected active run and cancels queued work without spawning', async () => {
    const setup = harness({ concurrency: 1 });
    const active = setup.runner.launch({ skill: version(), prompt: 'One', model: 'sonnet' });
    const queued = setup.runner.launch({ skill: version(), prompt: 'Two', model: 'sonnet' });
    await waitFor(() => setup.children.length === 1);

    expect(setup.runner.cancel(queued.id)).toBe(true);
    expect(setup.runner.get(queued.id)?.run.status).toBe('cancelled');
    expect(setup.children).toHaveLength(1);
    expect(setup.runner.cancel(active.id)).toBe(true);
    await waitFor(() => setup.runner.get(active.id)?.run.status === 'cancelled');
    expect(setup.groupSignals).toEqual([{ pid: setup.children[0].pid, signal: 'SIGTERM' }]);
  });

  it('escalates cancellation to SIGKILL and still completes bounded cleanup', async () => {
    const setup = harness({ closeOnTerm: false, killGraceMs: 5 });
    const run = setup.runner.launch({ skill: version(), prompt: 'One', model: 'sonnet' });
    await waitFor(() => setup.children.length === 1);

    setup.runner.cancel(run.id);
    await waitFor(() => setup.runner.get(run.id)?.run.status === 'cancelled');

    expect(setup.groupSignals).toEqual([
      { pid: setup.children[0].pid, signal: 'SIGTERM' },
      { pid: setup.children[0].pid, signal: 'SIGKILL' },
    ]);
    expect(setup.cleaned).toEqual(['/fake/project-1']);
  });

  it('fails assertion mismatches after a successful Claude result', async () => {
    const setup = harness();
    const run = setup.runner.launch({
      skill: version(),
      prompt: 'Prompt',
      model: 'sonnet',
      testCase: { ...testCase(), expectedContains: ['missing'] },
    });
    await waitFor(() => setup.children.length === 1);
    emitResult(setup.children[0]);
    setup.children[0].close(0);
    await waitFor(() => setup.runner.get(run.id)?.run.status === 'failed');

    expect(setup.runner.get(run.id)?.run.assertions[0]).toEqual({
      label: 'Output contains "missing"',
      passed: false,
    });
  });

  it('omits raw tool inputs, tool results, stderr, and secrets from traces', async () => {
    const setup = harness();
    const run = setup.runner.launch({ skill: version(), prompt: 'Prompt', model: 'sonnet' });
    await waitFor(() => setup.children.length === 1);
    const child = setup.children[0];
    child.stdout.write(
      `${JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: 'echo TOP_SECRET' } },
            { type: 'tool_result', content: 'TOP_SECRET_RESULT' },
          ],
        },
      })}\n`,
    );
    child.stderr.write('TOP_SECRET_STDERR');
    emitResult(child, 'safe answer');
    child.close(0);
    await waitFor(() => setup.runner.get(run.id)?.run.status === 'passed');

    const serializedTraces = JSON.stringify(setup.runner.get(run.id)?.traces);
    expect(serializedTraces).not.toContain('TOP_SECRET');
    expect(serializedTraces).not.toContain('echo');
    expect(serializedTraces).toContain('"name":"Shell"');
    expect(serializedTraces).toContain('Claude emitted diagnostic output.');
  });
});

describe('Claude readiness', () => {
  it('returns only availability, authentication, and a safe version', async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: '2.1.170 (Claude Code)\n' })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          loggedIn: true,
          credential: 'must-not-escape',
          subscriptionType: 'max',
        }),
      });

    await expect(
      getClaudeReadiness(command, { PATH: '/bin', HOME: '/home', SECRET: 'hidden' }),
    ).resolves.toEqual({
      available: true,
      authenticated: true,
      version: '2.1.170',
    });
    expect(command).toHaveBeenNthCalledWith(
      2,
      'claude',
      ['auth', 'status', '--json'],
      expect.objectContaining({ env: { PATH: '/bin', HOME: '/home' } }),
    );
  });

  it('reports an unavailable or unauthenticated CLI without leaking command output', async () => {
    await expect(
      getClaudeReadiness(async () => ({
        exitCode: 1,
        stdout: 'credential-shaped failure output',
      })),
    ).resolves.toEqual({ available: false, authenticated: false });
  });

  it('inherits only the allowlisted environment needed by Claude auth', () => {
    expect(
      createClaudeEnvironment({
        PATH: '/bin',
        HOME: '/home',
        CLAUDE_CODE_OAUTH_TOKEN: 'token',
        RANDOM_SECRET: 'hidden',
      }),
    ).toEqual({
      PATH: '/bin',
      HOME: '/home',
      CLAUDE_CODE_OAUTH_TOKEN: 'token',
    });
  });
});
