import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  SkillPackage,
  SkillTestCase,
  SkillTestRun,
  SkillTestStatus,
  SkillTestTrace,
  SkillVersion,
} from '../../domain/index.ts';
import { createClaudeEnvironment } from '../platform/claude-readiness.ts';
import { SkillTraceStore } from './skill-trace-store.ts';

type SkillSource = SkillVersion | SkillPackage;

export type SkillTestLaunch = {
  skill: SkillSource;
  prompt: string;
  model: string;
  testCase?: SkillTestCase;
  settings?: {
    maxTurns: number;
    timeoutSeconds: number;
    effort?: string;
    toolPreset?: 'none' | 'read-only';
  };
  workspace?: {
    id: string;
    label: string;
    path: string;
  };
};

export type SkillTestSnapshot = {
  run: SkillTestRun;
  traces: SkillTestTrace[];
};

export type SkillTestSubscriber = (snapshot: SkillTestSnapshot) => void;

export interface SkillRunnerChild {
  pid?: number;
  stdin: { end(data: string): void };
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  once(event: 'error', listener: (error: Error) => void): this;
  once(
    event: 'close',
    listener: (exitCode: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SkillRunnerSpawn = (
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    detached: boolean;
    stdio: ['pipe', 'pipe', 'pipe'];
  },
) => SkillRunnerChild;

export interface SkillRunnerFileSystem {
  createTempProject(): Promise<string>;
  writeSkillFile(
    projectDirectory: string,
    commandName: string,
    relativePath: string,
    content: string,
    mode: number,
  ): Promise<void>;
  cleanup(projectDirectory: string): Promise<void>;
}

export type SkillRunnerOptions = {
  concurrency?: number;
  timeoutMs?: number;
  killGraceMs?: number;
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxOutputLength?: number;
  environment?: NodeJS.ProcessEnv;
  spawn?: SkillRunnerSpawn;
  fileSystem?: SkillRunnerFileSystem;
  traceStore?: SkillTraceStore;
  persist?: (run: SkillTestRun) => void | Promise<void>;
  now?: () => Date;
  createId?: () => string;
  signalProcessGroup?: (pid: number, signal: NodeJS.Signals) => void;
};

type TerminalStatus = Extract<SkillTestStatus, 'passed' | 'failed' | 'cancelled' | 'timed-out'>;

type RunRecord = {
  run: SkillTestRun;
  files: SkillSource['files'];
  testCase?: SkillTestCase;
  commandName: string;
  child?: SkillRunnerChild;
  projectDirectory?: string;
  workspacePath?: string;
  timeout?: NodeJS.Timeout;
  killTimeout?: NodeJS.Timeout;
  lineBuffer: string;
  output: string;
  resultSeen: boolean;
  resultFailed: boolean;
  initialized: boolean;
  sawPartialText: boolean;
  sawMessageStart: boolean;
  assistantTurns: number;
  activeToolName?: string;
  maxTurns: number;
  timeoutMs: number;
  malformedLines: number;
  forcedStatus?: TerminalStatus;
  finished: boolean;
  completion: Promise<void>;
  resolveCompletion: () => void;
};

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_KILL_GRACE_MS = 1_000;
const DEFAULT_MAX_TURNS = 4;
const DEFAULT_MAX_BUDGET_USD = 0.25;
const DEFAULT_MAX_OUTPUT_LENGTH = 32_000;
const MAX_PROMPT_LENGTH = 32_000;
const MAX_SKILL_FILE_LENGTH = 1_000_000;
const MAX_SKILL_PACKAGE_LENGTH = 5_000_000;
const MAX_STREAM_LINE_LENGTH = 1_000_000;
const MAX_MALFORMED_WARNINGS = 20;

const defaultFileSystem: SkillRunnerFileSystem = {
  async createTempProject() {
    const directory = await mkdtemp(join(tmpdir(), 'claude-skill-studio-'));
    await chmod(directory, 0o700);
    return directory;
  },
  async writeSkillFile(projectDirectory, commandName, relativePath, content, mode) {
    const skillRoot = join(projectDirectory, '.claude', 'skills', commandName);
    const destination = join(skillRoot, ...relativePath.split('/'));
    const resolvedRoot = resolve(skillRoot);
    const resolvedDestination = resolve(destination);
    if (
      resolvedDestination !== resolvedRoot &&
      !relative(resolvedRoot, resolvedDestination).startsWith(`..${posix.sep}`)
    ) {
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, content, { mode: mode & 0o777 });
      return;
    }
    throw new Error('Skill file resolved outside its temporary skill directory');
  },
  async cleanup(projectDirectory) {
    await rm(projectDirectory, { recursive: true, force: true });
  },
};

const defaultSpawn: SkillRunnerSpawn = (command, args, options) =>
  spawn(command, [...args], options) as SkillRunnerChild;

function createCompletion(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function cloneRun(run: SkillTestRun): SkillTestRun {
  return {
    ...run,
    usage: run.usage ? { ...run.usage } : undefined,
    assertions: run.assertions.map((assertion) => ({ ...assertion })),
  };
}

function sourceIdentity(skill: SkillSource): { skillId: string; versionId: string } {
  return 'skillId' in skill
    ? { skillId: skill.skillId, versionId: skill.id }
    : { skillId: skill.id, versionId: skill.id };
}

function validateRelativePath(path: string): void {
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path === '..' ||
    path.startsWith('../')
  ) {
    throw new Error('Skill files must use normalized relative paths');
  }
}

function rewriteSkillName(files: SkillSource['files'], commandName: string): SkillSource['files'] {
  let rewroteManifest = false;
  const rewritten = files.map((file) => {
    validateRelativePath(file.path);
    if (file.path !== 'SKILL.md') {
      return { ...file };
    }

    const frontmatter = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) {
      throw new Error('SKILL.md must contain YAML frontmatter');
    }
    const replacement = /^name:\s*.*$/m.test(frontmatter[1])
      ? frontmatter[0].replace(/^name:\s*.*$/m, `name: ${commandName}`)
      : frontmatter[0].replace(/^---\r?\n/, `---\nname: ${commandName}\n`);
    rewroteManifest = true;
    return {
      ...file,
      content: `${replacement}${file.content.slice(frontmatter[0].length)}`,
    };
  });

  if (!rewroteManifest) {
    throw new Error('Skill package must contain a root SKILL.md');
  }
  return rewritten;
}

function validateLaunch(input: SkillTestLaunch): void {
  if (!input.prompt.trim() || input.prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error('Prompt must be non-empty and at most 32,000 characters');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,127}$/.test(input.model)) {
    throw new Error('Model must be a Claude model name or alias');
  }
  if (input.skill.files.length === 0 || input.skill.files.length > 100) {
    throw new Error('Skill package must contain between 1 and 100 files');
  }
  let packageLength = 0;
  const paths = new Set<string>();
  for (const file of input.skill.files) {
    if (file.content.length > MAX_SKILL_FILE_LENGTH) {
      throw new Error('Skill files must be at most 1,000,000 characters');
    }
    if (!Number.isInteger(file.mode) || file.mode < 0) {
      throw new Error('Skill file modes must be non-negative integers');
    }
    if (paths.has(file.path)) {
      throw new Error('Skill package file paths must be unique');
    }
    paths.add(file.path);
    packageLength += file.content.length;
  }
  if (packageLength > MAX_SKILL_PACKAGE_LENGTH) {
    throw new Error('Skill package must be at most 5,000,000 characters');
  }
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function coarseToolName(name: string | undefined): string {
  const normalized = name?.toLowerCase() ?? '';
  if (normalized.includes('skill')) return 'Skill';
  if (normalized.includes('bash') || normalized.includes('shell')) return 'Shell';
  if (['read', 'write', 'edit', 'glob', 'grep', 'file'].some((part) => normalized.includes(part))) {
    return 'Filesystem';
  }
  if (normalized.includes('web') || normalized.includes('http')) return 'Network';
  if (normalized.includes('task') || normalized.includes('agent')) return 'Agent';
  return 'Other';
}

export class SkillTestRunner {
  readonly #concurrency: number;
  readonly #timeoutMs: number;
  readonly #killGraceMs: number;
  readonly #maxTurns: number;
  readonly #maxBudgetUsd: number;
  readonly #maxOutputLength: number;
  readonly #environment: NodeJS.ProcessEnv;
  readonly #spawn: SkillRunnerSpawn;
  readonly #fileSystem: SkillRunnerFileSystem;
  readonly #traceStore: SkillTraceStore;
  readonly #persist?: (run: SkillTestRun) => void | Promise<void>;
  readonly #now: () => Date;
  readonly #createId: () => string;
  readonly #signalProcessGroup: (pid: number, signal: NodeJS.Signals) => void;
  readonly #records = new Map<string, RunRecord>();
  readonly #queue: string[] = [];
  readonly #subscribers = new Map<string, Set<SkillTestSubscriber>>();
  #activeCount = 0;
  #shuttingDown = false;

  constructor(options: SkillRunnerOptions = {}) {
    this.#concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    if (!Number.isInteger(this.#concurrency) || this.#concurrency < 1 || this.#concurrency > 2) {
      throw new RangeError('Skill test concurrency must be one or two');
    }
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#killGraceMs = options.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
    this.#maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.#maxBudgetUsd = options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD;
    this.#maxOutputLength = options.maxOutputLength ?? DEFAULT_MAX_OUTPUT_LENGTH;
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs < 1) {
      throw new RangeError('Skill test timeout must be positive');
    }
    if (!Number.isFinite(this.#killGraceMs) || this.#killGraceMs < 0) {
      throw new RangeError('Skill test kill grace must not be negative');
    }
    if (!Number.isInteger(this.#maxTurns) || this.#maxTurns < 1) {
      throw new RangeError('Skill test turn limit must be a positive integer');
    }
    if (!Number.isFinite(this.#maxBudgetUsd) || this.#maxBudgetUsd <= 0) {
      throw new RangeError('Skill test budget must be positive');
    }
    if (!Number.isInteger(this.#maxOutputLength) || this.#maxOutputLength < 1) {
      throw new RangeError('Skill test output capacity must be a positive integer');
    }
    this.#environment = createClaudeEnvironment(options.environment);
    this.#spawn = options.spawn ?? defaultSpawn;
    this.#fileSystem = options.fileSystem ?? defaultFileSystem;
    this.#traceStore = options.traceStore ?? new SkillTraceStore();
    this.#persist = options.persist;
    this.#now = options.now ?? (() => new Date());
    this.#createId = options.createId ?? randomUUID;
    this.#signalProcessGroup =
      options.signalProcessGroup ??
      ((pid, signal) => {
        process.kill(-pid, signal);
      });
  }

  launch(input: SkillTestLaunch): SkillTestRun {
    if (this.#shuttingDown) {
      throw new Error('Skill test runner is shutting down');
    }
    validateLaunch(input);

    const id = this.#createId();
    const commandName = `skill-test-${id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`;
    const files = rewriteSkillName(input.skill.files, commandName);
    const identity = sourceIdentity(input.skill);
    const maxTurns = input.settings?.maxTurns ?? this.#maxTurns;
    const timeoutMs = input.settings ? input.settings.timeoutSeconds * 1_000 : this.#timeoutMs;
    const effort = input.settings?.effort ?? 'high';
    const toolPreset = input.settings?.toolPreset ?? 'none';
    if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 20) {
      throw new Error('Turn limit must be between 1 and 20');
    }
    const minimumTimeout = input.settings ? 1_000 : 1;
    if (!Number.isFinite(timeoutMs) || timeoutMs < minimumTimeout || timeoutMs > 300_000) {
      throw new Error('Timeout must be between 1 and 300 seconds');
    }
    if (!['low', 'medium', 'high', 'xhigh', 'max', 'ultracode'].includes(effort)) {
      throw new Error('Unsupported effort level');
    }
    if (input.testCase && input.testCase.skillId !== identity.skillId) {
      throw new Error('Test case must belong to the selected skill');
    }
    const completion = createCompletion();
    const run: SkillTestRun = {
      id,
      ...identity,
      testCaseId: input.testCase?.id,
      prompt: input.prompt,
      model: input.model,
      effort,
      ...(input.workspace
        ? { projectId: input.workspace.id, workspaceLabel: input.workspace.label }
        : {}),
      toolPreset,
      status: 'queued',
      assertions: [],
    };
    this.#records.set(id, {
      run,
      files,
      workspacePath: input.workspace?.path,
      testCase: input.testCase,
      commandName,
      lineBuffer: '',
      output: '',
      resultSeen: false,
      resultFailed: false,
      initialized: false,
      sawPartialText: false,
      sawMessageStart: false,
      assistantTurns: 0,
      maxTurns,
      timeoutMs,
      malformedLines: 0,
      finished: false,
      completion: completion.promise,
      resolveCompletion: completion.resolve,
    });
    this.#queue.push(id);
    this.#addTrace(id, 'process', { state: 'queued' });
    this.#notify(id);
    this.#drainQueue();
    return cloneRun(run);
  }

  get(runId: string): SkillTestSnapshot | undefined {
    const record = this.#records.get(runId);
    return record ? { run: cloneRun(record.run), traces: this.#traceStore.list(runId) } : undefined;
  }

  subscribe(runId: string, subscriber: SkillTestSubscriber): () => void {
    if (!this.#records.has(runId)) {
      throw new Error('Unknown skill test run');
    }
    const subscribers = this.#subscribers.get(runId) ?? new Set<SkillTestSubscriber>();
    subscribers.add(subscriber);
    this.#subscribers.set(runId, subscribers);
    const snapshot = this.get(runId);
    if (snapshot) subscriber(snapshot);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.#subscribers.delete(runId);
    };
  }

  cancel(runId: string): boolean {
    const record = this.#records.get(runId);
    if (!record || record.finished) return false;

    if (record.run.status === 'queued') {
      const queueIndex = this.#queue.indexOf(runId);
      if (queueIndex >= 0) this.#queue.splice(queueIndex, 1);
      void this.#finish(record, 'cancelled');
      return true;
    }

    this.#terminate(record, 'cancelled', 'Cancellation requested.');
    return true;
  }

  async shutdown(): Promise<void> {
    this.#shuttingDown = true;
    const pending = [...this.#records.values()].filter((record) => !record.finished);
    for (const record of pending) {
      this.cancel(record.run.id);
    }
    await Promise.all(pending.map((record) => record.completion));
    this.#traceStore.clear();
    this.#subscribers.clear();
  }

  #drainQueue(): void {
    while (!this.#shuttingDown && this.#activeCount < this.#concurrency) {
      const runId = this.#queue.shift();
      if (!runId) return;
      const record = this.#records.get(runId);
      if (!record || record.finished) continue;
      this.#activeCount += 1;
      void this.#start(record);
    }
  }

  async #start(record: RunRecord): Promise<void> {
    record.run.status = 'running';
    record.run.startedAt = this.#now().toISOString();
    this.#addTrace(record.run.id, 'process', { state: 'preparing' });
    this.#notify(record.run.id);
    record.timeout = setTimeout(() => {
      this.#terminate(record, 'timed-out', 'The skill test exceeded its wall-time limit.');
    }, record.timeoutMs);

    try {
      record.projectDirectory = await this.#fileSystem.createTempProject();
      if (await this.#finishInterruptedPreparation(record)) return;
      for (const file of record.files) {
        await this.#fileSystem.writeSkillFile(
          record.projectDirectory,
          record.commandName,
          file.path,
          file.content,
          file.mode,
        );
        if (await this.#finishInterruptedPreparation(record)) return;
      }

      const args = [
        '-p',
        '--model',
        record.run.model,
        '--effort',
        record.run.effort ?? 'high',
        '--output-format',
        'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--no-session-persistence',
        '--setting-sources',
        'project',
        '--mcp-config',
        '{"mcpServers":{}}',
        '--strict-mcp-config',
        '--permission-mode',
        'dontAsk',
        '--tools',
        record.run.toolPreset === 'read-only' ? 'Read,Glob,Grep' : '',
        '--max-budget-usd',
        String(this.#maxBudgetUsd),
      ];
      if (record.workspacePath) {
        args.push('--add-dir', record.projectDirectory);
      }
      const child = this.#spawn('claude', args, {
        cwd: record.workspacePath ?? record.projectDirectory,
        env: this.#environment,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      record.child = child;
      this.#addTrace(record.run.id, 'process', { state: 'running' });
      child.stdout.on('data', (chunk: Buffer | string) => {
        this.#consumeChunk(record, chunk.toString());
      });
      let warnedAboutDiagnostics = false;
      child.stderr.on('data', () => {
        if (!warnedAboutDiagnostics) {
          warnedAboutDiagnostics = true;
          this.#addTrace(record.run.id, 'warning', {
            message: 'Claude emitted diagnostic output.',
          });
        }
      });
      child.once('error', () => {
        record.resultFailed = true;
        this.#addTrace(record.run.id, 'warning', { message: 'Claude failed to start.' });
      });
      child.once('close', (exitCode) => {
        void this.#handleClose(record, exitCode);
      });
      child.stdin.end(`/${record.commandName} ${record.run.prompt}`);
    } catch {
      if (record.finished) return;
      this.#addTrace(record.run.id, 'warning', {
        message: 'The skill test could not be prepared.',
      });
      if (record.child) {
        this.#terminate(record, 'failed', 'Claude input could not be delivered.');
        return;
      }
      await this.#finish(record, 'failed');
    }
  }

  async #finishInterruptedPreparation(record: RunRecord): Promise<boolean> {
    if (!record.forcedStatus) return false;
    await this.#finish(record, record.forcedStatus);
    return true;
  }

  #consumeChunk(record: RunRecord, chunk: string): void {
    record.lineBuffer += chunk;
    if (record.lineBuffer.length > MAX_STREAM_LINE_LENGTH && !record.lineBuffer.includes('\n')) {
      record.lineBuffer = '';
      this.#malformed(record);
      return;
    }

    const lines = record.lineBuffer.split(/\r?\n/);
    record.lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      this.#consumeLine(record, line);
    }
  }

  #consumeLine(record: RunRecord, line: string): void {
    if (!line.trim()) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      this.#malformed(record);
      return;
    }
    const event = readRecord(value);
    const type = readString(event, 'type');
    if (!event || !type) {
      this.#malformed(record);
      return;
    }

    if (type === 'stream_event') {
      this.#consumeStreamEvent(record, readRecord(event.event));
      return;
    }
    if (type === 'assistant') {
      this.#consumeAssistant(record, readRecord(event.message));
      return;
    }
    if (type === 'result') {
      this.#consumeResult(record, event);
      return;
    }
    if (type === 'system') {
      if (!record.initialized) {
        record.initialized = true;
        this.#addTrace(record.run.id, 'process', { state: 'initialized' });
      }
    }
  }

  #consumeStreamEvent(record: RunRecord, event: Record<string, unknown> | undefined): void {
    const eventType = readString(event, 'type');
    if (eventType === 'message_start') {
      record.sawMessageStart = true;
      record.assistantTurns += 1;
      if (record.assistantTurns > record.maxTurns) {
        this.#terminate(record, 'failed', 'The skill test exceeded its turn limit.');
      }
      return;
    }

    if (eventType === 'content_block_delta') {
      const delta = readRecord(event?.delta);
      if (readString(delta, 'type') === 'text_delta') {
        const text = readString(delta, 'text');
        if (text) {
          record.sawPartialText = true;
          this.#appendOutput(record, text);
          this.#addTrace(record.run.id, 'assistant', { text });
        }
      }
      return;
    }

    if (eventType === 'content_block_start') {
      const block = readRecord(event?.content_block);
      if (readString(block, 'type') === 'tool_use') {
        record.activeToolName = coarseToolName(readString(block, 'name'));
        this.#addTrace(record.run.id, 'tool', {
          name: record.activeToolName,
          status: 'started',
        });
      }
      return;
    }

    if (eventType === 'content_block_stop' && record.activeToolName) {
      this.#addTrace(record.run.id, 'tool', {
        name: record.activeToolName,
        status: 'completed',
      });
      record.activeToolName = undefined;
    }
  }

  #consumeAssistant(record: RunRecord, message: Record<string, unknown> | undefined): void {
    if (!record.sawMessageStart) {
      record.assistantTurns += 1;
      if (record.assistantTurns > record.maxTurns) {
        this.#terminate(record, 'failed', 'The skill test exceeded its turn limit.');
        return;
      }
    }
    const content = message?.content;
    if (!Array.isArray(content)) return;

    for (const item of content) {
      const block = readRecord(item);
      const blockType = readString(block, 'type');
      if (blockType === 'text' && !record.sawPartialText) {
        const text = readString(block, 'text');
        if (text) {
          this.#appendOutput(record, text);
          this.#addTrace(record.run.id, 'assistant', { text });
        }
      } else if (blockType === 'tool_use') {
        this.#addTrace(record.run.id, 'tool', {
          name: coarseToolName(readString(block, 'name')),
          status: 'started',
        });
      }
    }
  }

  #consumeResult(record: RunRecord, event: Record<string, unknown>): void {
    record.resultSeen = true;
    record.resultFailed = event.is_error === true || readString(event, 'subtype') === 'error';
    const result = readString(event, 'result');
    if (result && !record.output) this.#appendOutput(record, result);

    const usage = readRecord(event.usage);
    const inputTokens = readNumber(usage, 'input_tokens');
    const outputTokens = readNumber(usage, 'output_tokens');
    const costUsd = readNumber(event, 'total_cost_usd');
    if (inputTokens !== undefined || outputTokens !== undefined || costUsd !== undefined) {
      record.run.usage = { inputTokens, outputTokens, costUsd };
    }
    this.#addTrace(record.run.id, 'result', {
      status: record.resultFailed ? 'failed' : 'completed',
    });
  }

  #appendOutput(record: RunRecord, text: string): void {
    const remaining = this.#maxOutputLength - record.output.length;
    if (remaining > 0) record.output += text.slice(0, remaining);
  }

  #malformed(record: RunRecord): void {
    record.malformedLines += 1;
    if (record.malformedLines <= MAX_MALFORMED_WARNINGS) {
      this.#addTrace(record.run.id, 'warning', {
        message: 'Claude emitted an unrecognized stream event.',
      });
    }
  }

  async #handleClose(record: RunRecord, exitCode: number | null): Promise<void> {
    if (record.finished) return;
    if (record.lineBuffer.trim()) {
      this.#consumeLine(record, record.lineBuffer);
      record.lineBuffer = '';
    }
    record.run.exitCode = exitCode ?? undefined;

    let status = record.forcedStatus;
    if (!status) {
      status = exitCode === 0 && record.resultSeen && !record.resultFailed ? 'passed' : 'failed';
      if (exitCode === 0 && !record.resultSeen) {
        this.#addTrace(record.run.id, 'warning', {
          message: 'Claude exited without a valid result event.',
        });
      }
    }
    await this.#finish(record, status);
  }

  #terminate(record: RunRecord, status: TerminalStatus, warning: string): void {
    if (record.finished || record.forcedStatus) return;
    record.forcedStatus = status;
    this.#addTrace(record.run.id, 'warning', { message: warning });
    const child = record.child;
    if (!child) {
      return;
    }
    this.#signal(child, 'SIGTERM');
    record.killTimeout = setTimeout(() => {
      if (!record.finished) {
        this.#signal(child, 'SIGKILL');
        void this.#finish(record, status);
      }
    }, this.#killGraceMs);
  }

  #signal(child: SkillRunnerChild, signal: NodeJS.Signals): void {
    if (process.platform !== 'win32' && child.pid) {
      try {
        this.#signalProcessGroup(child.pid, signal);
        return;
      } catch {
        // Fall back to the owned child only.
      }
    }
    try {
      child.kill(signal);
    } catch {
      // The child may have exited between the state check and signal.
    }
  }

  async #finish(record: RunRecord, status: TerminalStatus): Promise<void> {
    if (record.finished) return;
    record.finished = true;
    if (record.timeout) clearTimeout(record.timeout);
    if (record.killTimeout) clearTimeout(record.killTimeout);

    record.run.output = record.output || undefined;
    record.run.assertions = this.#evaluateAssertions(record);
    if (status === 'passed' && record.run.assertions.some((assertion) => !assertion.passed)) {
      status = 'failed';
    }
    record.run.status = status;
    record.run.finishedAt = this.#now().toISOString();
    if (record.run.startedAt) {
      record.run.durationMs =
        new Date(record.run.finishedAt).getTime() - new Date(record.run.startedAt).getTime();
    }
    this.#addTrace(record.run.id, 'process', { state: status });

    if (record.projectDirectory) {
      try {
        await this.#fileSystem.cleanup(record.projectDirectory);
      } catch {
        this.#addTrace(record.run.id, 'warning', {
          message: 'Temporary skill files could not be removed.',
        });
      }
    }

    if (this.#persist) {
      try {
        await this.#persist(cloneRun(record.run));
      } catch {
        this.#addTrace(record.run.id, 'warning', {
          message: 'The completed skill test could not be persisted.',
        });
      }
    }

    if (record.run.startedAt) this.#activeCount -= 1;
    this.#notify(record.run.id);
    record.resolveCompletion();
    this.#drainQueue();
  }

  #evaluateAssertions(record: RunRecord): SkillTestRun['assertions'] {
    if (!record.testCase) return [];
    return [
      ...record.testCase.expectedContains.map((expected) => ({
        label: `Output contains "${expected}"`,
        passed: record.output.includes(expected),
      })),
      ...record.testCase.expectedExcludes.map((excluded) => ({
        label: `Output excludes "${excluded}"`,
        passed: !record.output.includes(excluded),
      })),
    ];
  }

  #addTrace(
    runId: string,
    kind: SkillTestTrace['kind'],
    value:
      | { state: string }
      | { text: string }
      | { name: string; status: string }
      | {
          status: string;
        }
      | { message: string },
  ): void {
    const common = {
      id: this.#createId(),
      timestamp: this.#now().toISOString(),
    };
    let trace: SkillTestTrace;
    switch (kind) {
      case 'process':
        trace = { ...common, kind, state: (value as { state: string }).state };
        break;
      case 'assistant':
        trace = { ...common, kind, text: (value as { text: string }).text };
        break;
      case 'tool':
        trace = { ...common, kind, ...(value as { name: string; status: string }) };
        break;
      case 'result':
        trace = { ...common, kind, status: (value as { status: string }).status };
        break;
      case 'warning':
        trace = { ...common, kind, message: (value as { message: string }).message };
        break;
    }
    this.#traceStore.add(runId, trace);
    this.#notify(runId);
  }

  #notify(runId: string): void {
    const snapshot = this.get(runId);
    if (!snapshot) return;
    for (const subscriber of this.#subscribers.get(runId) ?? []) {
      subscriber(snapshot);
    }
  }
}
