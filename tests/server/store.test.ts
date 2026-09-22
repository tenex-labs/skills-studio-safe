import { describe, expect, it, vi } from 'vitest';

import { formatSse } from '../../server/collector.ts';
import { MissionEventStore } from '../../server/store.ts';
import type { MissionEvent } from '../../server/types.ts';

function event(id: string): MissionEvent {
  return {
    id,
    timestamp: '2026-09-21T16:00:00.000Z',
    sessionId: 'sha256:session',
    kind: 'session',
    action: 'start',
    status: 'started',
  };
}

describe('MissionEventStore', () => {
  it('keeps a bounded, insertion-ordered snapshot', () => {
    const store = new MissionEventStore(2);
    store.add(event('one'));
    store.add(event('two'));
    store.add(event('three'));

    expect(store.list().map(({ id }) => id)).toEqual(['two', 'three']);
    expect(store.acceptedCount).toBe(3);
  });

  it('publishes new events until the subscriber disconnects', () => {
    const store = new MissionEventStore();
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);

    store.add(event('one'));
    unsubscribe();
    store.add(event('two'));

    expect(subscriber).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenCalledWith(event('one'));
    expect(store.subscriberCount).toBe(0);
  });
});

describe('formatSse', () => {
  it('formats one complete default SSE message for EventSource.onmessage', () => {
    expect(formatSse(event('event-1'))).toBe(
      'id: event-1\ndata: {"id":"event-1","timestamp":"2026-09-21T16:00:00.000Z","sessionId":"sha256:session","kind":"session","action":"start","status":"started"}\n\n',
    );
  });
});
