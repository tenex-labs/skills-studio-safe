import { access, chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLLECTOR_URL = 'http://127.0.0.1:4319/hooks';
export const OWNERSHIP_HEADER = 'X-Agent-Mission-Control';
export const OWNERSHIP_VALUE = 'local-v1';
export const HOOK_TIMEOUT_SECONDS = 1;

export const HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
  'SubagentStart',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
  'PreCompact',
  'PostCompact',
  'Stop',
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptDirectory, '..');
export const settingsPath = resolve(projectRoot, '.claude', 'settings.local.json');
export const backupPath = `${settingsPath}.agent-mission-control.backup.json`;

export async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonObject(path, fallback = {}) {
  if (!(await pathExists(path))) {
    return structuredClone(fallback);
  }

  const text = await readFile(path, 'utf8');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Cannot safely update invalid JSON at ${path}`);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object at ${path}`);
  }
  return value;
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, path);
}

export function ownedHttpHook() {
  return {
    type: 'http',
    url: COLLECTOR_URL,
    timeout: HOOK_TIMEOUT_SECONDS,
    headers: {
      [OWNERSHIP_HEADER]: OWNERSHIP_VALUE,
    },
  };
}

export function isOwnedHttpHook(hook) {
  return (
    hook &&
    typeof hook === 'object' &&
    hook.type === 'http' &&
    hook.url === COLLECTOR_URL &&
    hook.headers?.[OWNERSHIP_HEADER] === OWNERSHIP_VALUE
  );
}

export function getOwnedHookStatus(settings) {
  const registrationsByEvent =
    settings?.hooks && typeof settings.hooks === 'object' && !Array.isArray(settings.hooks)
      ? settings.hooks
      : {};
  const installedEvents = HOOK_EVENTS.filter((eventName) => {
    const registrations = registrationsByEvent[eventName];
    return (
      Array.isArray(registrations) &&
      registrations.some(
        (registration) =>
          Array.isArray(registration?.hooks) && registration.hooks.some(isOwnedHttpHook),
      )
    );
  });

  return {
    status: installedEvents.length === HOOK_EVENTS.length ? 'installed' : 'missing',
    installedEventCount: installedEvents.length,
    requiredEventCount: HOOK_EVENTS.length,
  };
}

export async function readOwnedHookStatus() {
  const settings = await readJsonObject(settingsPath);
  return getOwnedHookStatus(settings);
}

export function addOwnedHooks(settings) {
  const next = structuredClone(settings);
  if (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks)) {
    if (next.hooks !== undefined) {
      throw new Error('Expected the existing hooks setting to be an object');
    }
    next.hooks = {};
  }

  let added = 0;
  for (const eventName of HOOK_EVENTS) {
    const registrations = next.hooks[eventName];
    if (registrations !== undefined && !Array.isArray(registrations)) {
      throw new Error(`Expected hooks.${eventName} to be an array`);
    }

    const existing = registrations ?? [];
    const alreadyConnected = existing.some(
      (registration) =>
        Array.isArray(registration?.hooks) && registration.hooks.some(isOwnedHttpHook),
    );
    if (!alreadyConnected) {
      next.hooks[eventName] = [...existing, { hooks: [ownedHttpHook()] }];
      added += 1;
    }
  }

  return { settings: next, added };
}

export function removeOwnedHooks(settings) {
  const next = structuredClone(settings);
  if (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks)) {
    return { settings: next, removed: 0 };
  }

  let removed = 0;
  for (const [eventName, registrations] of Object.entries(next.hooks)) {
    if (!Array.isArray(registrations)) continue;

    const keptRegistrations = [];
    for (const registration of registrations) {
      if (!Array.isArray(registration?.hooks)) {
        keptRegistrations.push(registration);
        continue;
      }

      const keptHooks = registration.hooks.filter((hook) => {
        if (!isOwnedHttpHook(hook)) return true;
        removed += 1;
        return false;
      });
      if (keptHooks.length > 0) {
        keptRegistrations.push({ ...registration, hooks: keptHooks });
      }
    }

    if (keptRegistrations.length > 0) {
      next.hooks[eventName] = keptRegistrations;
    } else {
      delete next.hooks[eventName];
    }
  }

  if (Object.keys(next.hooks).length === 0) {
    delete next.hooks;
  }
  return { settings: next, removed };
}

export async function createBackup(settings, existed) {
  if (await pathExists(backupPath)) return false;
  await writeJsonAtomic(backupPath, {
    format: 1,
    existed,
    settings,
  });
  return true;
}

export async function readBackup() {
  if (!(await pathExists(backupPath))) return undefined;
  const backup = await readJsonObject(backupPath);
  if (
    backup.format !== 1 ||
    typeof backup.existed !== 'boolean' ||
    !backup.settings ||
    typeof backup.settings !== 'object' ||
    Array.isArray(backup.settings)
  ) {
    throw new Error(`Invalid Agent Mission Control backup at ${backupPath}`);
  }
  return backup;
}

export async function removeFile(path) {
  await rm(path, { force: true });
}

export function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
