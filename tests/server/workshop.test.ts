import { describe, expect, it } from 'vitest';

import { classifyWorkshopAction } from '../../scripts/workshop.mjs';

describe('workshop startup decision', () => {
  it('starts only when both fixed ports are free', () => {
    expect(
      classifyWorkshopAction([
        { port: 4319, status: 'free' },
        { port: 5173, status: 'free' },
      ]),
    ).toBe('start');
  });

  it('does not duplicate a complete running app', () => {
    expect(
      classifyWorkshopAction([
        { port: 4319, status: 'app-running' },
        { port: 5173, status: 'app-running' },
      ]),
    ).toBe('already-running');
  });

  it('blocks conflicts and partial app states', () => {
    expect(
      classifyWorkshopAction([
        { port: 4319, status: 'conflict' },
        { port: 5173, status: 'free' },
      ]),
    ).toBe('blocked');
    expect(
      classifyWorkshopAction([
        { port: 4319, status: 'app-running' },
        { port: 5173, status: 'free' },
      ]),
    ).toBe('blocked');
  });
});
