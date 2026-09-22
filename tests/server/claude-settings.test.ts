import { describe, expect, it } from 'vitest';

import {
  HOOK_EVENTS,
  addOwnedHooks,
  getOwnedHookStatus,
  isOwnedHttpHook,
  removeOwnedHooks,
} from '../../scripts/claude-settings.mjs';

describe('Claude settings integration', () => {
  it('merges idempotently and preserves existing settings', () => {
    const existingHook = {
      matcher: 'existing',
      hooks: [{ type: 'command', command: 'existing-command' }],
    };
    const original = {
      permissions: { allow: ['Read'] },
      hooks: { PreToolUse: [existingHook] },
    };

    const first = addOwnedHooks(original);
    const second = addOwnedHooks(first.settings);

    expect(first.added).toBe(HOOK_EVENTS.length);
    expect(second.added).toBe(0);
    expect(second.settings.permissions).toEqual(original.permissions);
    expect(second.settings.hooks.PreToolUse[0]).toEqual(existingHook);
    expect(
      second.settings.hooks.PreToolUse.flatMap((registration) => registration.hooks).filter(
        isOwnedHttpHook,
      ),
    ).toHaveLength(1);
    expect(getOwnedHookStatus(second.settings)).toEqual({
      status: 'installed',
      installedEventCount: HOOK_EVENTS.length,
      requiredEventCount: HOOK_EVENTS.length,
    });
  });

  it('reports missing until every owned event hook is present', () => {
    const partial = addOwnedHooks({}).settings;
    partial.hooks.Stop = [];

    expect(getOwnedHookStatus({})).toMatchObject({ status: 'missing', installedEventCount: 0 });
    expect(getOwnedHookStatus(partial)).toMatchObject({
      status: 'missing',
      installedEventCount: HOOK_EVENTS.length - 1,
    });
  });

  it('disconnect removes only owned entries', () => {
    const existingHook = {
      matcher: 'existing',
      hooks: [{ type: 'command', command: 'existing-command' }],
    };
    const original = {
      model: 'existing-model',
      hooks: { PreToolUse: [existingHook] },
    };
    const connected = addOwnedHooks(original).settings;
    const disconnected = removeOwnedHooks(connected);

    expect(disconnected.removed).toBe(HOOK_EVENTS.length);
    expect(disconnected.settings).toEqual(original);
  });
});
