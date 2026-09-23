import type { SkillTestTrace } from '../../domain/index.ts';

export type SkillTraceStoreOptions = {
  maxEventsPerRun?: number;
  maxTextLength?: number;
};

const DEFAULT_MAX_EVENTS = 500;
const DEFAULT_MAX_TEXT_LENGTH = 4_000;

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function boundTrace(trace: SkillTestTrace, maxTextLength: number): SkillTestTrace {
  switch (trace.kind) {
    case 'assistant':
      return { ...trace, text: truncate(trace.text, maxTextLength) };
    case 'warning':
      return { ...trace, message: truncate(trace.message, maxTextLength) };
    case 'tool':
      return { ...trace, name: truncate(trace.name, maxTextLength) };
    case 'process':
    case 'result':
      return trace;
  }
}

/** Holds a bounded, in-memory window of traces per run. Nothing here is ever persisted. */
export class SkillTraceStore {
  readonly #maxEventsPerRun: number;
  readonly #maxTextLength: number;
  readonly #traces = new Map<string, SkillTestTrace[]>();

  constructor(options: SkillTraceStoreOptions = {}) {
    this.#maxEventsPerRun = options.maxEventsPerRun ?? DEFAULT_MAX_EVENTS;
    this.#maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

    if (!Number.isInteger(this.#maxEventsPerRun) || this.#maxEventsPerRun < 1) {
      throw new RangeError('Trace event capacity must be a positive integer');
    }
    if (!Number.isInteger(this.#maxTextLength) || this.#maxTextLength < 1) {
      throw new RangeError('Trace text capacity must be a positive integer');
    }
  }

  add(runId: string, trace: SkillTestTrace): void {
    const bounded = boundTrace(trace, this.#maxTextLength);
    const traces = this.#traces.get(runId) ?? [];
    traces.push(bounded);
    if (traces.length > this.#maxEventsPerRun) {
      traces.splice(0, traces.length - this.#maxEventsPerRun);
    }
    this.#traces.set(runId, traces);
  }

  list(runId: string): SkillTestTrace[] {
    return [...(this.#traces.get(runId) ?? [])];
  }

  delete(runId: string): void {
    this.#traces.delete(runId);
  }

  clear(): void {
    this.#traces.clear();
  }
}
