import type { SkillTestTrace } from '../../domain/index.ts';

export type SkillTraceSubscriber = (trace: SkillTestTrace) => void;

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
    case 'process':
      return { ...trace, state: truncate(trace.state, maxTextLength) };
    case 'tool':
      return {
        ...trace,
        name: truncate(trace.name, maxTextLength),
        status: truncate(trace.status, maxTextLength),
      };
    case 'result':
      return { ...trace, status: truncate(trace.status, maxTextLength) };
  }
}

export class SkillTraceStore {
  readonly #maxEventsPerRun: number;
  readonly #maxTextLength: number;
  readonly #traces = new Map<string, SkillTestTrace[]>();
  readonly #subscribers = new Map<string, Set<SkillTraceSubscriber>>();

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

    for (const subscriber of this.#subscribers.get(runId) ?? []) {
      subscriber(bounded);
    }
  }

  list(runId: string): SkillTestTrace[] {
    return [...(this.#traces.get(runId) ?? [])];
  }

  subscribe(runId: string, subscriber: SkillTraceSubscriber): () => void {
    const subscribers = this.#subscribers.get(runId) ?? new Set<SkillTraceSubscriber>();
    subscribers.add(subscriber);
    this.#subscribers.set(runId, subscribers);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.#subscribers.delete(runId);
      }
    };
  }

  delete(runId: string): void {
    this.#traces.delete(runId);
    this.#subscribers.delete(runId);
  }

  clear(): void {
    this.#traces.clear();
    this.#subscribers.clear();
  }
}
