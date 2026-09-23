import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import {
  evaluateAssertions,
  isEffortLevel,
  isToolPreset,
  testRunLimits,
  type EffortLevel,
  type SkillPackage,
  type SkillTestCase,
  type SkillTestRun,
  type SkillTestTrace,
  type SkillTestTraceInput,
  type SkillVersion,
  type TerminalTestStatus,
  type TestRunSettings,
  type ToolPreset,
} from '../../domain/index.ts';
import { StudioValidationError } from '../errors.ts';
import { createClaudeEnvironment } from '../platform/claude-readiness.ts';
import { parseStreamLine, type ClaudeStreamEvent } from './stream-parser.ts';
import {
  prepareTestPackage,
  tempDirectoryFileSystem,
  type SkillRunnerFileSystem,
} from './test-package.ts';
import { SkillTraceStore } from './skill-trace-store.ts';

export type { SkillRunnerFileSystem } from './test-package.ts';

type SkillSource = SkillVersion | SkillPackage;

export type SkillTestLaunch = {
  skill: SkillSource;
  prompt: string;
  model: string;
  testCase?: SkillTestCase;
  settings?: Partial<TestRunSettings>;
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

export type SkillRunnerOptions = {
  concurrency?: number;
  timeoutMs?: number;
  killGraceMs?: number;
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxOutputLength?: number;
  /** How long a finished run stays in memory so late SSE clients can still read its outcome. */
  finishedRetentionMs?: number;
  environment?: NodeJS.ProcessEnv;
  spawn?: SkillRunnerSpawn;
  fileSystem?: SkillRunnerFileSystem;
  traceStore?: SkillTraceStore;
  persist?: (run: SkillTestRun) => void | Promise<void>;
  now?: () => Date;
  createId?: () => string;
  signalProcessGroup?: (pid: number, signal: NodeJS.Signals) => void;
};

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
  forcedStatus?: TerminalTestStatus;
  finished: boolean;
  completion: Promise<void>;
  resolveCompletion: () => void;
};

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_TIMEOUT_MS = testRunLimits.timeoutSeconds.default * 1_000;
const DEFAULT_KILL_GRACE_MS = 1_000;
const DEFAULT_MAX_BUDGET_USD = 0.25;
const DEFAULT_MAX_OUTPUT_LENGTH = 32_000;
const DEFAULT_FINISHED_RETENTION_MS = 60_000;
const MAX_PROMPT_LENGTH = 32_000;
const MAX_STREAM_LINE_LENGTH = 1_000_000;
const MAX_MALFORMED_WARNINGS = 20;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,127}$/;

const defaultSpawn: SkillRunnerSpawn = (command, args, options) =>
  spawn(command, [...args], options) as SkillRunnerChild;

function createCompletion(): { promise: Promise<void>; resolve: () => void } {
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

function inRange(value: number, limits: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= limits.min && value <= limits.max;
}

/** Resolves per-run settings and rejects anything outside the shared limits. */
function resolveSettings(
  settings: Partial<TestRunSettings> | undefined,
  defaults: { maxTurns: number; timeoutMs: number },
): { maxTurns: number; timeoutMs: number; effort: EffortLevel; toolPreset: ToolPreset } {
  const maxTurns = settings?.maxTurns ?? defaults.maxTurns;
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > testRunLimits.maxTurns.max) {
    throw new StudioValidationError(
      `Turn limit must be between 1 and ${testRunLimits.maxTurns.max}`,
    );
  }
  if (
    settings?.timeoutSeconds !== undefined &&
    !inRange(settings.timeoutSeconds, testRunLimits.timeoutSeconds)
  ) {
    const { min, max } = testRunLimits.timeoutSeconds;
    throw new StudioValidationError(`Timeout must be between ${min} and ${max} seconds`);
  }
  const effort = settings?.effort ?? 'high';
  if (!isEffortLevel(effort)) throw new StudioValidationError('Unsupported effort level');
  const toolPreset = settings?.toolPreset ?? 'none';
  if (!isToolPreset(toolPreset)) throw new StudioValidationError('Unsupported tool preset');
  return {
    maxTurns,
    timeoutMs:
      settings?.timeoutSeconds === undefined ? defaults.timeoutMs : settings.timeoutSeconds * 1_000,
    effort,
    toolPreset,
  };
}

/**
 * Runs skill tests as bounded `claude -p` child processes and exposes their progress as ephemeral
 * traces. Each run copies the skill into a temp project under a unique command name, so the user's
 * installed skills are never touched and never collide with the copy under test.
 */
export class SkillTestRunner {
  readonly #concurrency: number;
  readonly #timeoutMs: number;
  readonly #killGraceMs: number;
  readonly #maxTurns: number;
  readonly #maxBudgetUsd: number;
  readonly #maxOutputLength: number;
  readonly #finishedRetentionMs: number;
  readonly #environment: NodeJS.ProcessEnv;
  readonly #spawn: SkillRunnerSpawn;
  readonly #fileSystem: SkillRunnerFileSystem;
  readonly #traceStore: SkillTraceStore;
  readonly #persist?: (run: SkillTestRun) => void | Promise<void>;
  readonly #now: () => Date;
  readonly #createId: () => string;
  readonly #signalProcessGroup: (pid: number, signal: NodeJS.Signals) => void;
  readonly #records = new Map<string, RunRecord>();
  readonly #evictions = new Set<NodeJS.Timeout>();
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
    this.#maxTurns = options.maxTurns ?? testRunLimits.maxTurns.default;
    this.#maxBudgetUsd = options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD;
    this.#maxOutputLength = options.maxOutputLength ?? DEFAULT_MAX_OUTPUT_LENGTH;
    this.#finishedRetentionMs = options.finishedRetentionMs ?? DEFAULT_FINISHED_RETENTION_MS;
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
    if (!Number.isFinite(this.#finishedRetentionMs) || this.#finishedRetentionMs < 0) {
      throw new RangeError('Finished run retention must not be negative');
    }
    this.#environment = createClaudeEnvironment(options.environment);
    this.#spawn = options.spawn ?? defaultSpawn;
    this.#fileSystem = options.fileSystem ?? tempDirectoryFileSystem;
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

  /** Runs that are queued or running. Finished runs awaiting eviction are not counted. */
  get activeRunCount(): number {
    return [...this.#records.values()].filter(({ finished }) => !finished).length;
  }

  launch(input: SkillTestLaunch): SkillTestRun {
    if (this.#shuttingDown) {
      throw new Error('Skill test runner is shutting down');
    }
    if (!input.prompt.trim() || input.prompt.length > MAX_PROMPT_LENGTH) {
      throw new StudioValidationError('Prompt must be non-empty and at most 32,000 characters');
    }
    if (!MODEL_PATTERN.test(input.model)) {
      throw new StudioValidationError('Model must be a Claude model name or alias');
    }
    const identity = sourceIdentity(input.skill);
    if (input.testCase && input.testCase.skillId !== identity.skillId) {
      throw new StudioValidationError('Test case must belong to the selected skill');
    }
    const settings = resolveSettings(input.settings, {
      maxTurns: this.#maxTurns,
      timeoutMs: this.#timeoutMs,
    });

    const id = this.#createId();
    const commandName = `skill-test-${id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`;
    const files = prepareTestPackage(input.skill.files, commandName);
    const completion = createCompletion();
    const run: SkillTestRun = {
      id,
      ...identity,
      testCaseId: input.testCase?.id,
      prompt: input.prompt,
      model: input.model,
      effort: settings.effort,
      ...(input.workspace
        ? { projectId: input.workspace.id, workspaceLabel: input.workspace.label }
        : {}),
      toolPreset: settings.toolPreset,
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
      maxTurns: settings.maxTurns,
      timeoutMs: settings.timeoutMs,
      malformedLines: 0,
      finished: false,
      completion: completion.promise,
      resolveCompletion: completion.resolve,
    });
    this.#queue.push(id);
    this.#addTrace(id, { kind: 'process', state: 'queued' });
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
    for (const eviction of this.#evictions) clearTimeout(eviction);
    this.#evictions.clear();
    this.#records.clear();
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

  #claudeArguments(record: RunRecord): string[] {
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
    // In a trusted workspace the process starts in the project, so the temp copy of the skill is
    // added as an extra directory for Claude to discover.
    if (record.workspacePath && record.projectDirectory) {
      args.push('--add-dir', record.projectDirectory);
    }
    return args;
  }

  async #start(record: RunRecord): Promise<void> {
    record.run.status = 'running';
    record.run.startedAt = this.#now().toISOString();
    this.#addTrace(record.run.id, { kind: 'process', state: 'preparing' });
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

      const child = this.#spawn('claude', this.#claudeArguments(record), {
        cwd: record.workspacePath ?? record.projectDirectory,
        env: this.#environment,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      record.child = child;
      this.#addTrace(record.run.id, { kind: 'process', state: 'running' });
      child.stdout.on('data', (chunk: Buffer | string) => {
        this.#consumeChunk(record, chunk.toString());
      });
      let warnedAboutDiagnostics = false;
      child.stderr.on('data', () => {
        if (!warnedAboutDiagnostics) {
          warnedAboutDiagnostics = true;
          this.#addTrace(record.run.id, {
            kind: 'warning',
            message: 'Claude emitted diagnostic output.',
          });
        }
      });
      child.once('error', () => {
        record.resultFailed = true;
        this.#addTrace(record.run.id, { kind: 'warning', message: 'Claude failed to start.' });
      });
      child.once('close', (exitCode) => {
        void this.#handleClose(record, exitCode);
      });
      child.stdin.end(`/${record.commandName} ${record.run.prompt}`);
    } catch {
      if (record.finished) return;
      this.#addTrace(record.run.id, {
        kind: 'warning',
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
      this.#apply(record, parseStreamLine(line));
    }
  }

  #apply(record: RunRecord, event: ClaudeStreamEvent): void {
    const runId = record.run.id;
    switch (event.type) {
      case 'ignored':
        return;
      case 'malformed':
        this.#malformed(record);
        return;
      case 'initialized':
        if (!record.initialized) {
          record.initialized = true;
          this.#addTrace(runId, { kind: 'process', state: 'initialized' });
        }
        return;
      case 'turn-started':
        record.sawMessageStart = true;
        this.#countTurn(record);
        return;
      case 'text-delta':
        record.sawPartialText = true;
        this.#appendOutput(record, event.text);
        this.#addTrace(runId, { kind: 'assistant', text: event.text });
        return;
      case 'tool-started':
        record.activeToolName = event.tool;
        this.#addTrace(runId, { kind: 'tool', name: event.tool, status: 'started' });
        return;
      case 'block-stopped':
        if (record.activeToolName) {
          this.#addTrace(runId, { kind: 'tool', name: record.activeToolName, status: 'completed' });
          record.activeToolName = undefined;
        }
        return;
      case 'assistant-message':
        // Complete messages repeat what partial events already streamed. They only count turns and
        // supply text when the CLI did not stream partial output.
        if (!record.sawMessageStart && !this.#countTurn(record)) return;
        if (!record.sawPartialText) {
          for (const text of event.texts) {
            this.#appendOutput(record, text);
            this.#addTrace(runId, { kind: 'assistant', text });
          }
        }
        for (const tool of event.tools) {
          this.#addTrace(runId, { kind: 'tool', name: tool, status: 'started' });
        }
        return;
      case 'result':
        record.resultSeen = true;
        record.resultFailed = event.failed;
        if (event.result && !record.output) this.#appendOutput(record, event.result);
        if (event.usage) record.run.usage = event.usage;
        return;
    }
  }

  /** Counts one assistant turn and returns false once the run has exceeded its turn limit. */
  #countTurn(record: RunRecord): boolean {
    record.assistantTurns += 1;
    if (record.assistantTurns <= record.maxTurns) return true;
    this.#terminate(record, 'failed', 'The skill test exceeded its turn limit.');
    return false;
  }

  #appendOutput(record: RunRecord, text: string): void {
    const remaining = this.#maxOutputLength - record.output.length;
    if (remaining > 0) record.output += text.slice(0, remaining);
  }

  #malformed(record: RunRecord): void {
    record.malformedLines += 1;
    if (record.malformedLines <= MAX_MALFORMED_WARNINGS) {
      this.#addTrace(record.run.id, {
        kind: 'warning',
        message: 'Claude emitted an unrecognized stream event.',
      });
    }
  }

  async #handleClose(record: RunRecord, exitCode: number | null): Promise<void> {
    if (record.finished) return;
    if (record.lineBuffer.trim()) {
      this.#apply(record, parseStreamLine(record.lineBuffer));
      record.lineBuffer = '';
    }
    record.run.exitCode = exitCode ?? undefined;

    let status = record.forcedStatus;
    if (!status) {
      status = exitCode === 0 && record.resultSeen && !record.resultFailed ? 'passed' : 'failed';
      if (exitCode === 0 && !record.resultSeen) {
        this.#addTrace(record.run.id, {
          kind: 'warning',
          message: 'Claude exited without a valid result event.',
        });
      }
    }
    await this.#finish(record, status);
  }

  #terminate(record: RunRecord, status: TerminalTestStatus, warning: string): void {
    if (record.finished || record.forcedStatus) return;
    record.forcedStatus = status;
    this.#addTrace(record.run.id, { kind: 'warning', message: warning });
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

  async #finish(record: RunRecord, status: TerminalTestStatus): Promise<void> {
    if (record.finished) return;
    record.finished = true;
    if (record.timeout) clearTimeout(record.timeout);
    if (record.killTimeout) clearTimeout(record.killTimeout);

    record.run.output = record.output || undefined;
    record.run.assertions = evaluateAssertions(record.testCase, record.output);
    record.run.status = status;
    record.run.finishedAt = this.#now().toISOString();
    if (record.run.startedAt) {
      record.run.durationMs =
        new Date(record.run.finishedAt).getTime() - new Date(record.run.startedAt).getTime();
    }

    if (record.projectDirectory) {
      try {
        await this.#fileSystem.cleanup(record.projectDirectory);
      } catch {
        this.#addTrace(record.run.id, {
          kind: 'warning',
          message: 'Temporary skill files could not be removed.',
        });
      }
    }

    if (this.#persist) {
      try {
        await this.#persist(cloneRun(record.run));
      } catch {
        this.#addTrace(record.run.id, {
          kind: 'warning',
          message: 'The completed skill test could not be persisted.',
        });
      }
    }

    if (record.run.startedAt) this.#activeCount -= 1;
    // The result trace is last so a client that sees it can read the final, persisted run.
    this.#addTrace(record.run.id, { kind: 'result', status });
    this.#scheduleEviction(record.run.id);
    record.resolveCompletion();
    this.#drainQueue();
  }

  #scheduleEviction(runId: string): void {
    const eviction = setTimeout(() => {
      this.#evictions.delete(eviction);
      this.#records.delete(runId);
      this.#traceStore.delete(runId);
      this.#subscribers.delete(runId);
    }, this.#finishedRetentionMs);
    eviction.unref?.();
    this.#evictions.add(eviction);
  }

  #addTrace(runId: string, input: SkillTestTraceInput): void {
    this.#traceStore.add(runId, {
      ...input,
      id: this.#createId(),
      timestamp: this.#now().toISOString(),
    });
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
