import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { MissionEvent, MissionEventKind, MissionEventStatus } from './types.ts';

const hookNames = [
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

export type HookName = (typeof hookNames)[number];

const hookPayloadSchema = z.object({
  hook_event_name: z.enum(hookNames),
  session_id: z.string().min(1).max(512),
  prompt_id: z.string().min(1).max(512).optional(),
  agent_id: z.string().min(1).max(512).optional(),
  parent_agent_id: z.string().min(1).max(512).optional(),
  agent_type: z.string().min(1).max(128).optional(),
  tool_name: z.string().min(1).max(128).optional(),
  duration_ms: z.number().finite().nonnegative().max(86_400_000).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  cwd: z.string().min(1).max(4096).optional(),
  project_dir: z.string().min(1).max(4096).optional(),
  repository: z.string().min(1).max(4096).optional(),
});

type HookDescriptor = {
  kind: MissionEventKind;
  action: string;
  status: MissionEventStatus;
};

const hookDescriptors: Record<HookName, HookDescriptor> = {
  SessionStart: { kind: 'session', action: 'start', status: 'started' },
  SessionEnd: { kind: 'session', action: 'end', status: 'completed' },
  UserPromptSubmit: { kind: 'prompt', action: 'submit', status: 'started' },
  PreToolUse: { kind: 'tool', action: 'use', status: 'started' },
  PostToolUse: { kind: 'tool', action: 'use', status: 'succeeded' },
  PostToolUseFailure: { kind: 'tool', action: 'use', status: 'failed' },
  PermissionRequest: {
    kind: 'permission',
    action: 'request',
    status: 'blocked',
  },
  PermissionDenied: {
    kind: 'permission',
    action: 'deny',
    status: 'failed',
  },
  SubagentStart: { kind: 'subagent', action: 'start', status: 'started' },
  SubagentStop: { kind: 'subagent', action: 'stop', status: 'completed' },
  TaskCreated: { kind: 'task', action: 'create', status: 'started' },
  TaskCompleted: { kind: 'task', action: 'complete', status: 'completed' },
  PreCompact: { kind: 'compact', action: 'start', status: 'started' },
  PostCompact: { kind: 'compact', action: 'finish', status: 'completed' },
  Stop: { kind: 'stop', action: 'stop', status: 'completed' },
};

export class InvalidHookPayloadError extends Error {
  constructor() {
    super('Invalid hook payload');
    this.name = 'InvalidHookPayloadError';
  }
}

export type NormalizationOptions = {
  now?: () => Date;
  createId?: () => string;
};

export function hashIdentifier(identifier: string): string {
  return `sha256:${createHash('sha256').update(identifier).digest('hex')}`;
}

export function sanitizeRepository(repository: string): string | undefined {
  const basename = repository.replaceAll('\\', '/').split('/').filter(Boolean).at(-1);
  if (!basename) {
    return undefined;
  }

  const label = basename
    .replace(/\.git$/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return label || undefined;
}

function sanitizeAgentType(agentType: string): string | undefined {
  const label = agentType.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 64);
  return label || undefined;
}

function categorizeTool(toolName: string): string {
  if (/^(Read|Glob|Grep)$/i.test(toolName)) return 'file-read';
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/i.test(toolName)) return 'file-write';
  if (/^(Bash|Shell)$/i.test(toolName)) return 'shell';
  if (/^(Task|Agent)$/i.test(toolName)) return 'subagent';
  if (/^(WebFetch|WebSearch)$/i.test(toolName)) return 'web';
  if (/^mcp/i.test(toolName)) return 'mcp';
  return 'other';
}

export function normalizeHookPayload(
  input: unknown,
  options: NormalizationOptions = {},
): MissionEvent {
  const parsed = hookPayloadSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidHookPayloadError();
  }

  const payload = parsed.data;
  const descriptor = hookDescriptors[payload.hook_event_name];
  const event: MissionEvent = {
    id: (options.createId ?? randomUUID)(),
    timestamp: payload.timestamp ?? (options.now ?? (() => new Date()))().toISOString(),
    sessionId: hashIdentifier(payload.session_id),
    kind: descriptor.kind,
    action: descriptor.action,
    status: descriptor.status,
  };

  if (payload.prompt_id) event.promptId = hashIdentifier(payload.prompt_id);
  if (payload.agent_id) event.agentId = hashIdentifier(payload.agent_id);
  if (payload.parent_agent_id) {
    event.parentAgentId = hashIdentifier(payload.parent_agent_id);
  }
  if (payload.agent_type) {
    event.agentType = sanitizeAgentType(payload.agent_type);
  }
  if (payload.tool_name && descriptor.kind === 'tool') {
    event.toolCategory = categorizeTool(payload.tool_name);
  }
  if (payload.duration_ms !== undefined) {
    event.durationMs = payload.duration_ms;
  }

  const repository = payload.repository ?? payload.project_dir ?? payload.cwd;
  if (repository) {
    event.repository = sanitizeRepository(repository);
  }

  return event;
}
