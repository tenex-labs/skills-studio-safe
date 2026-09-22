import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MissionEventStore } from './store.ts';

const projectRoot = import.meta.url.startsWith('file:')
  ? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  : process.cwd();
const settingsPath = resolve(projectRoot, '.claude', 'settings.local.json');
const collectorUrl = 'http://127.0.0.1:4319/hooks';
const ownershipHeader = 'X-Agent-Mission-Control';
const ownershipValue = 'local-v1';
const hookEvents = [
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
] as const;

export type HookInstallationStatus = 'installed' | 'missing';

export type ClaudeCliStatus = {
  available: boolean;
  version?: string;
};

export type SetupStatusDependencies = {
  getHookStatus?: () => Promise<HookInstallationStatus>;
  getClaudeCliStatus?: () => Promise<ClaudeCliStatus>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOwnedHook(value: unknown): boolean {
  if (!isRecord(value) || value.type !== 'http' || value.url !== collectorUrl) return false;
  return isRecord(value.headers) && value.headers[ownershipHeader] === ownershipValue;
}

export function getHookStatusFromSettings(settings: unknown): HookInstallationStatus {
  if (!isRecord(settings) || !isRecord(settings.hooks)) return 'missing';
  const hooks = settings.hooks;

  const installed = hookEvents.every((eventName) => {
    const registrations = hooks[eventName];
    return (
      Array.isArray(registrations) &&
      registrations.some(
        (registration) =>
          isRecord(registration) &&
          Array.isArray(registration.hooks) &&
          registration.hooks.some(isOwnedHook),
      )
    );
  });
  return installed ? 'installed' : 'missing';
}

async function readHookStatus(): Promise<HookInstallationStatus> {
  try {
    const contents = await readFile(settingsPath, 'utf8');
    return getHookStatusFromSettings(JSON.parse(contents) as unknown);
  } catch {
    return 'missing';
  }
}

export function observeClaudeCli(): Promise<ClaudeCliStatus> {
  return new Promise((resolveStatus) => {
    const executable = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    execFile(
      executable,
      ['--version'],
      { encoding: 'utf8', timeout: 2_000, maxBuffer: 16 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolveStatus({ available: false });
          return;
        }
        const version = `${stdout || stderr}`.trim().split(/\r?\n/, 1)[0]?.slice(0, 160);
        resolveStatus(version ? { available: true, version } : { available: true });
      },
    );
  });
}

export function createSetupStatusProvider(
  store: MissionEventStore,
  dependencies: SetupStatusDependencies = {},
) {
  const getHookStatus = dependencies.getHookStatus ?? readHookStatus;
  const getClaudeCliStatus = dependencies.getClaudeCliStatus ?? observeClaudeCli;
  let claudeStatus: Promise<ClaudeCliStatus> | undefined;

  return async () => {
    claudeStatus ??= getClaudeCliStatus();
    return {
      collectorReady: true,
      hooks: { status: await getHookStatus() },
      events: {
        acceptedCount: store.acceptedCount,
        firstEventReceived: store.acceptedCount > 0,
      },
      claude: await claudeStatus,
    };
  };
}
