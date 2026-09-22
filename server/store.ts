import type { MissionEvent } from './types.ts';

export type EventSubscriber = (event: MissionEvent) => void;

export class MissionEventStore {
  readonly #capacity: number;
  readonly #events: MissionEvent[] = [];
  readonly #subscribers = new Set<EventSubscriber>();
  #acceptedCount = 0;

  constructor(capacity = 500) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Event store capacity must be a positive integer');
    }
    this.#capacity = capacity;
  }

  add(event: MissionEvent): void {
    this.#acceptedCount += 1;
    this.#events.push(event);
    if (this.#events.length > this.#capacity) {
      this.#events.splice(0, this.#events.length - this.#capacity);
    }

    for (const subscriber of this.#subscribers) {
      subscriber(event);
    }
  }

  list(): MissionEvent[] {
    return [...this.#events];
  }

  subscribe(subscriber: EventSubscriber): () => void {
    this.#subscribers.add(subscriber);
    return () => {
      this.#subscribers.delete(subscriber);
    };
  }

  get size(): number {
    return this.#events.length;
  }

  get acceptedCount(): number {
    return this.#acceptedCount;
  }

  get subscriberCount(): number {
    return this.#subscribers.size;
  }
}
