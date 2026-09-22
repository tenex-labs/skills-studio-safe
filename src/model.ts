import { z } from 'zod';
import {
  missionEventKinds,
  missionEventStatuses,
  type MissionEvent,
} from '../shared/mission-event';
export type { MissionEvent } from '../shared/mission-event';

export type RunStatus = 'running' | 'waiting' | 'failed' | 'complete';
export type RunSource = 'seeded' | 'live';
export type VerificationStatus = 'passed' | 'failed' | 'pending' | 'unavailable';
export const missionEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  sessionId: z.string(),
  promptId: z.string().optional(),
  agentId: z.string().optional(),
  parentAgentId: z.string().optional(),
  agentType: z.string().optional(),
  kind: z.enum(missionEventKinds),
  action: z.string(),
  status: z.enum(missionEventStatuses),
  toolCategory: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  repository: z.string().optional(),
});
export type ApprovalDecision = 'pending' | 'allowed' | 'denied' | 'clarify';

const eventLabels: Record<MissionEvent['kind'], string> = {
  session: 'Session',
  prompt: 'Prompt',
  tool: 'Tool',
  permission: 'Permission',
  subagent: 'Subagent',
  task: 'Task',
  compact: 'Context compaction',
  stop: 'Run',
};

export function eventTitle(event: MissionEvent): string {
  if (event.kind === 'permission' && event.action === 'request') {
    return 'Approval requested';
  }
  return `${eventLabels[event.kind]} ${event.action}`;
}

export function eventDetail(event: MissionEvent): string {
  const facts = [
    event.toolCategory ? `Category: ${event.toolCategory}` : undefined,
    event.agentType ? `Agent: ${event.agentType}` : undefined,
    event.durationMs !== undefined ? `Duration: ${event.durationMs} ms` : undefined,
    `Status: ${event.status}`,
  ];
  return facts.filter(Boolean).join(' · ');
}

export function liveRunsFromEvents(events: MissionEvent[]): AgentRun[] {
  const sessions = new Map<string, MissionEvent[]>();
  for (const event of events) {
    if (event.sessionId.startsWith('run-')) continue;
    sessions.set(event.sessionId, [...(sessions.get(event.sessionId) ?? []), event]);
  }

  return [...sessions.entries()].map(([sessionId, sessionEvents]) => {
    const ordered = [...sessionEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const latest = ordered.at(-1)!;
    const failed = ordered.some(({ status }) => status === 'failed');
    const blocked = !failed && ordered.some(({ status }) => status === 'blocked');
    const complete =
      !failed &&
      !blocked &&
      ordered.some(
        ({ kind, status }) => (kind === 'session' || kind === 'stop') && status === 'completed',
      );
    const status: RunStatus = failed
      ? 'failed'
      : blocked
        ? 'waiting'
        : complete
          ? 'complete'
          : 'running';
    const agentType = [...ordered].reverse().find(({ agentType }) => agentType)?.agentType;
    const repository = [...ordered].reverse().find(({ repository }) => repository)?.repository;

    return {
      id: sessionId,
      agent: agentType ?? 'Claude',
      task: `Live Claude session · ${sessionId.slice(-8)}`,
      project: repository ?? 'local-project',
      branch: 'local',
      status,
      startedAt: ordered[0].timestamp,
      updatedAt: latest.timestamp,
      progress: complete ? 100 : blocked ? 65 : failed ? 40 : 48,
      tokens: null,
      cost: null,
      needsAttention: failed || blocked,
      source: 'live',
      verification: 'unavailable',
    };
  });
}

export interface AgentRun {
  id: string;
  agent: string;
  task: string;
  project: string;
  branch: string;
  status: RunStatus;
  startedAt: string;
  updatedAt: string;
  progress: number;
  tokens: number | null;
  cost: number | null;
  needsAttention: boolean;
  source: RunSource;
  verification: VerificationStatus;
}

export interface Approval {
  id: string;
  runId: string;
  tool: string;
  request: string;
  rationale: string;
  risk: 'low' | 'medium' | 'high';
  requestedAt: string;
  decision: ApprovalDecision;
  simulated?: boolean;
}

export type FacilitatorScenarioId = 'clarification' | 'risky-shell' | 'verification-failure';

export interface FacilitatorScenario {
  id: FacilitatorScenarioId;
  label: string;
  description: string;
  decision: Omit<Approval, 'id' | 'requestedAt' | 'decision'>;
}

export interface SubagentNode {
  id: string;
  parentId?: string;
  agentType: string;
  status: MissionEvent['status'];
  eventCount: number;
}

export interface RunComparison {
  status: string;
  duration: string;
  events: string;
  failedTools: string;
  subagents: string;
  tokens: string;
  cost: string;
  verification: string;
}

export interface SetupReadiness {
  collector: 'ready' | 'unavailable';
  hooks: 'installed' | 'missing' | 'unknown';
  firstEvent: 'received' | 'waiting';
  detail?: string;
}

export const setupFallback: SetupReadiness = {
  collector: 'unavailable',
  hooks: 'unknown',
  firstEvent: 'waiting',
  detail: 'Setup status is unavailable. Seed mode continues.',
};

function readBoolean(value: unknown, keys: string[]): boolean | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'boolean') return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      for (const nestedKey of ['ready', 'installed', 'received', 'connected', 'ok']) {
        if (typeof nested[nestedKey] === 'boolean') return nested[nestedKey];
      }
    }
  }
  return undefined;
}

export function normalizeSetupReadiness(value: unknown): SetupReadiness {
  const collectorReady = readBoolean(value, ['collectorReady', 'collector']);
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  const hooksRecord =
    record?.hooks && typeof record.hooks === 'object'
      ? (record.hooks as Record<string, unknown>)
      : undefined;
  const eventsRecord =
    record?.events && typeof record.events === 'object'
      ? (record.events as Record<string, unknown>)
      : undefined;
  const hooksInstalled =
    hooksRecord?.status === 'installed'
      ? true
      : hooksRecord?.status === 'missing'
        ? false
        : readBoolean(value, ['hooksInstalled', 'hooks']);
  const firstEventReceived =
    typeof eventsRecord?.firstEventReceived === 'boolean'
      ? eventsRecord.firstEventReceived
      : readBoolean(value, [
          'firstEventReceived',
          'hasReceivedEvent',
          'liveEventReceived',
          'firstEvent',
        ]);

  if (collectorReady === undefined) return setupFallback;
  return {
    collector: collectorReady ? 'ready' : 'unavailable',
    hooks: hooksInstalled === undefined ? 'unknown' : hooksInstalled ? 'installed' : 'missing',
    firstEvent: firstEventReceived ? 'received' : 'waiting',
  };
}

export function projectSubagents(events: MissionEvent[], sessionId: string): SubagentNode[] {
  const agents = new Map<string, SubagentNode>();
  const runEvents = events
    .filter((event) => event.sessionId === sessionId && event.agentId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (const event of runEvents) {
    const id = event.agentId!;
    const existing = agents.get(id);
    agents.set(id, {
      id,
      parentId: event.parentAgentId ?? existing?.parentId,
      agentType: event.agentType ?? existing?.agentType ?? 'agent',
      status: event.status,
      eventCount: (existing?.eventCount ?? 0) + 1,
    });
  }

  return [...agents.values()];
}

export function runComparison(run: AgentRun, events: MissionEvent[]): RunComparison {
  const runEvents = events.filter((event) => event.sessionId === run.id);
  const durationMs = Math.max(0, Date.parse(run.updatedAt) - Date.parse(run.startedAt));
  const durationMinutes = Math.round(durationMs / 60_000);
  const failedTools = runEvents.filter(
    (event) => event.kind === 'tool' && event.status === 'failed',
  ).length;
  const subagents = projectSubagents(runEvents, run.id).filter(({ parentId }) => parentId).length;

  return {
    status: statusLabelText(run.status),
    duration: `${durationMinutes} min`,
    events: `${runEvents.length}`,
    failedTools: `${failedTools}`,
    subagents: `${subagents}`,
    tokens: run.tokens === null ? 'Unavailable' : run.tokens.toLocaleString(),
    cost: run.cost === null ? 'Unavailable' : `$${run.cost.toFixed(2)}`,
    verification:
      run.verification === 'unavailable'
        ? 'Unavailable'
        : run.verification.charAt(0).toUpperCase() + run.verification.slice(1),
  };
}

function statusLabelText(status: RunStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const facilitatorScenarios: FacilitatorScenario[] = [
  {
    id: 'clarification',
    label: 'Clarification needed',
    description: 'Inject an ambiguous requirement for human clarification.',
    decision: {
      runId: 'run-kite-08',
      tool: 'Question',
      request: 'Clarify the expected export retention window',
      rationale: 'The safe next step depends on a product decision not present in run metadata.',
      risk: 'low',
      simulated: true,
    },
  },
  {
    id: 'risky-shell',
    label: 'Risky shell action',
    description: 'Inject a destructive-looking shell request for review.',
    decision: {
      runId: 'run-atlas-27',
      tool: 'Shell',
      request: 'Review a potentially destructive local shell action',
      rationale: 'The scenario tests whether the operator pauses before allowing a risky action.',
      risk: 'high',
      simulated: true,
    },
  },
  {
    id: 'verification-failure',
    label: 'Verification failure',
    description: 'Inject a failed verification result that needs a human decision.',
    decision: {
      runId: 'run-nova-14',
      tool: 'Verification',
      request: 'Decide how to proceed after verification failed',
      rationale: 'The run cannot claim completion while its deterministic verification is failing.',
      risk: 'medium',
      simulated: true,
    },
  },
];

export function injectFacilitatorScenario(
  decisions: Approval[],
  scenarioId: FacilitatorScenarioId,
): Approval[] {
  const scenario = facilitatorScenarios.find(({ id }) => id === scenarioId);
  if (!scenario) return decisions;
  const sequence =
    decisions.filter(({ id }) => id.startsWith(`scenario-${scenarioId}-`)).length + 1;
  return [
    {
      ...scenario.decision,
      id: `scenario-${scenarioId}-${sequence}`,
      requestedAt: `2026-09-21T17:${String(sequence).padStart(2, '0')}:00Z`,
      decision: 'pending',
    },
    ...decisions,
  ];
}

export function resolveDecision(
  decisions: Approval[],
  id: string,
  decision: ApprovalDecision,
): Approval[] {
  return decisions.map((item) => (item.id === id ? { ...item, decision } : item));
}

export const seedRuns: AgentRun[] = [
  {
    id: 'run-atlas-27',
    agent: 'Atlas',
    task: 'Repair payment retry reconciliation',
    project: 'commerce-api',
    branch: 'fix/retry-ledger',
    status: 'waiting',
    startedAt: '2026-09-21T16:34:00Z',
    updatedAt: '2026-09-21T16:55:00Z',
    progress: 68,
    tokens: 18420,
    cost: 3.84,
    needsAttention: true,
    source: 'seeded',
    verification: 'pending',
  },
  {
    id: 'run-kite-08',
    agent: 'Kite',
    task: 'Add audit log export endpoint',
    project: 'platform-core',
    branch: 'feat/audit-export',
    status: 'running',
    startedAt: '2026-09-21T16:41:00Z',
    updatedAt: '2026-09-21T16:57:00Z',
    progress: 46,
    tokens: 12110,
    cost: 2.22,
    needsAttention: false,
    source: 'seeded',
    verification: 'pending',
  },
  {
    id: 'run-nova-14',
    agent: 'Nova',
    task: 'Investigate flaky workspace sync',
    project: 'desktop',
    branch: 'debug/workspace-sync',
    status: 'failed',
    startedAt: '2026-09-21T15:52:00Z',
    updatedAt: '2026-09-21T16:20:00Z',
    progress: 39,
    tokens: 22931,
    cost: 4.91,
    needsAttention: true,
    source: 'seeded',
    verification: 'failed',
  },
  {
    id: 'run-ember-31',
    agent: 'Ember',
    task: 'Tighten session cookie policy',
    project: 'identity',
    branch: 'security/cookie-policy',
    status: 'complete',
    startedAt: '2026-09-21T14:18:00Z',
    updatedAt: '2026-09-21T15:04:00Z',
    progress: 100,
    tokens: 27402,
    cost: 5.17,
    needsAttention: false,
    source: 'seeded',
    verification: 'passed',
  },
];

export const seedApprovals: Approval[] = [
  {
    id: 'approval-1',
    runId: 'run-atlas-27',
    tool: 'Bash',
    request: 'Run the ledger repair against the local database',
    rationale: 'Confirms the migration is idempotent before a review is requested.',
    risk: 'medium',
    requestedAt: '2026-09-21T16:55:00Z',
    decision: 'pending',
  },
  {
    id: 'approval-2',
    runId: 'run-nova-14',
    tool: 'Write',
    request: 'Replace the generated workspace lock fixture',
    rationale: 'The current fixture reproduces the race only intermittently.',
    risk: 'high',
    requestedAt: '2026-09-21T16:18:00Z',
    decision: 'pending',
  },
  {
    id: 'approval-3',
    runId: 'run-kite-08',
    tool: 'WebFetch',
    request: 'Read the public OpenAPI pagination guidance',
    rationale: 'Checks response cursor conventions.',
    risk: 'low',
    requestedAt: '2026-09-21T16:02:00Z',
    decision: 'allowed',
  },
];

export const seedEvents: MissionEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-09-21T16:34:00Z',
    sessionId: 'run-atlas-27',
    kind: 'session',
    action: 'start',
    status: 'started',
    repository: 'commerce-api',
    agentId: 'agent-atlas-root',
    agentType: 'lead',
  },
  {
    id: 'e2',
    timestamp: '2026-09-21T16:39:00Z',
    sessionId: 'run-atlas-27',
    kind: 'tool',
    action: 'use',
    status: 'succeeded',
    toolCategory: 'file-read',
    agentId: 'agent-atlas-root',
    agentType: 'lead',
  },
  {
    id: 'e3',
    timestamp: '2026-09-21T16:48:00Z',
    sessionId: 'run-atlas-27',
    kind: 'task',
    action: 'complete',
    status: 'completed',
    agentId: 'agent-atlas-analysis',
    parentAgentId: 'agent-atlas-root',
    agentType: 'explore',
  },
  {
    id: 'e4',
    timestamp: '2026-09-21T16:55:00Z',
    sessionId: 'run-atlas-27',
    kind: 'permission',
    action: 'request',
    status: 'blocked',
    toolCategory: 'shell',
    agentId: 'agent-atlas-root',
    agentType: 'lead',
  },
  {
    id: 'e5',
    timestamp: '2026-09-21T16:57:00Z',
    sessionId: 'run-kite-08',
    kind: 'tool',
    action: 'use',
    status: 'started',
    toolCategory: 'shell',
    agentId: 'agent-kite-root',
    agentType: 'lead',
  },
  {
    id: 'e6',
    timestamp: '2026-09-21T16:20:00Z',
    sessionId: 'run-nova-14',
    kind: 'tool',
    action: 'use',
    status: 'failed',
    toolCategory: 'file-write',
    agentId: 'agent-nova-verify',
    parentAgentId: 'agent-nova-root',
    agentType: 'verification',
  },
  {
    id: 'e7',
    timestamp: '2026-09-21T15:04:00Z',
    sessionId: 'run-ember-31',
    kind: 'session',
    action: 'end',
    status: 'completed',
    agentId: 'agent-ember-root',
    agentType: 'lead',
  },
  {
    id: 'e8',
    timestamp: '2026-09-21T16:43:00Z',
    sessionId: 'run-atlas-27',
    agentId: 'agent-atlas-analysis',
    parentAgentId: 'agent-atlas-root',
    agentType: 'explore',
    kind: 'subagent',
    action: 'start',
    status: 'started',
  },
  {
    id: 'e9',
    timestamp: '2026-09-21T16:51:00Z',
    sessionId: 'run-atlas-27',
    agentId: 'agent-atlas-review',
    parentAgentId: 'agent-atlas-root',
    agentType: 'review',
    kind: 'subagent',
    action: 'complete',
    status: 'completed',
  },
];

export const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
