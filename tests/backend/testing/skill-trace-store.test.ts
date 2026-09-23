import { describe, expect, it } from 'vitest';

import { SkillTraceStore } from '../../../app/backend/testing/skill-trace-store.ts';

describe('SkillTraceStore', () => {
  it('bounds each run independently and truncates free-text fields', () => {
    const store = new SkillTraceStore({ maxEventsPerRun: 2, maxTextLength: 5 });
    store.add('run-1', {
      id: 'one',
      timestamp: '2026-09-22T12:00:00.000Z',
      kind: 'assistant',
      text: '123456789',
    });
    store.add('run-1', {
      id: 'two',
      timestamp: '2026-09-22T12:00:01.000Z',
      kind: 'process',
      state: 'running',
    });
    store.add('run-1', {
      id: 'three',
      timestamp: '2026-09-22T12:00:02.000Z',
      kind: 'result',
      status: 'passed',
    });
    store.add('run-2', {
      id: 'other',
      timestamp: '2026-09-22T12:00:00.000Z',
      kind: 'warning',
      message: 'warning text',
    });

    expect(store.list('run-1')).toEqual([
      expect.objectContaining({ id: 'two', state: 'running' }),
      expect.objectContaining({ id: 'three', status: 'passed' }),
    ]);
    expect(store.list('run-2')).toEqual([
      expect.objectContaining({ id: 'other', message: 'warn…' }),
    ]);
  });

  it('returns defensive copies and forgets deleted runs', () => {
    const store = new SkillTraceStore();
    const trace = {
      id: 'one',
      timestamp: '2026-09-22T12:00:00.000Z',
      kind: 'process' as const,
      state: 'running' as const,
    };

    store.add('run', trace);
    store.list('run').splice(0);
    expect(store.list('run')).toEqual([trace]);

    store.delete('run');
    expect(store.list('run')).toEqual([]);
  });
});
