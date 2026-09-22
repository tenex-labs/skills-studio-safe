export const missionEventKinds = [
  'session',
  'prompt',
  'tool',
  'permission',
  'subagent',
  'task',
  'compact',
  'stop',
] as const;

export const missionEventStatuses = [
  'started',
  'succeeded',
  'failed',
  'blocked',
  'completed',
] as const;

export type MissionEvent = {
  id: string;
  timestamp: string;
  sessionId: string;
  promptId?: string;
  agentId?: string;
  parentAgentId?: string;
  agentType?: string;
  kind: (typeof missionEventKinds)[number];
  action: string;
  status: (typeof missionEventStatuses)[number];
  toolCategory?: string;
  durationMs?: number;
  repository?: string;
};
