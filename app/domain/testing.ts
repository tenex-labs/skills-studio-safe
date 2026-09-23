export type SkillTestCase = {
  id: string;
  skillId: string;
  name: string;
  prompt: string;
  expectedContains: string[];
  expectedExcludes: string[];
  createdAt: string;
};

export const skillTestStatuses = [
  'queued',
  'running',
  'passed',
  'failed',
  'cancelled',
  'timed-out',
] as const;
export type SkillTestStatus = (typeof skillTestStatuses)[number];

export type SkillTestTrace =
  | { id: string; timestamp: string; kind: 'process'; state: string }
  | { id: string; timestamp: string; kind: 'assistant'; text: string }
  | { id: string; timestamp: string; kind: 'tool'; name: string; status: string }
  | { id: string; timestamp: string; kind: 'result'; status: string }
  | { id: string; timestamp: string; kind: 'warning'; message: string };

export type SkillTestRun = {
  id: string;
  skillId: string;
  versionId: string;
  testCaseId?: string;
  prompt: string;
  model: string;
  effort?: string;
  projectId?: string;
  workspaceLabel?: string;
  toolPreset?: 'none' | 'read-only';
  status: SkillTestStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number;
  output?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  };
  assertions: {
    label: string;
    passed: boolean;
  }[];
};
