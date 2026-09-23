export const effortLevels = ['low', 'medium', 'high', 'xhigh', 'max', 'ultracode'] as const;
export type EffortLevel = (typeof effortLevels)[number];

export const toolPresets = ['none', 'read-only'] as const;
export type ToolPreset = (typeof toolPresets)[number];

export function isEffortLevel(value: unknown): value is EffortLevel {
  return (effortLevels as readonly unknown[]).includes(value);
}

export function isToolPreset(value: unknown): value is ToolPreset {
  return (toolPresets as readonly unknown[]).includes(value);
}

export const testRunLimits = {
  maxTurns: { min: 1, max: 20, default: 4 },
  timeoutSeconds: { min: 10, max: 300, default: 60 },
} as const;

export type TestRunSettings = {
  maxTurns: number;
  timeoutSeconds: number;
  effort: EffortLevel;
  toolPreset: ToolPreset;
};

export type LaunchTestInput = {
  skillId: string;
  versionId: string;
  testCaseId?: string;
  prompt: string;
  model: string;
  projectId?: string;
  settings: TestRunSettings;
};

export type SkillTestCase = {
  id: string;
  skillId: string;
  name: string;
  prompt: string;
  expectedContains: string[];
  expectedExcludes: string[];
  createdAt: string;
};

export type NewSkillTestCase = Pick<
  SkillTestCase,
  'name' | 'prompt' | 'expectedContains' | 'expectedExcludes'
>;

export const skillTestStatuses = [
  'queued',
  'running',
  'passed',
  'failed',
  'cancelled',
  'timed-out',
  'interrupted',
] as const;
export type SkillTestStatus = (typeof skillTestStatuses)[number];
export type TerminalTestStatus = Exclude<SkillTestStatus, 'queued' | 'running'>;

export function isTerminalStatus(status: SkillTestStatus): status is TerminalTestStatus {
  return status !== 'queued' && status !== 'running';
}

type TraceBody =
  | { kind: 'process'; state: 'queued' | 'preparing' | 'running' | 'initialized' }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; status: 'started' | 'completed' }
  | { kind: 'warning'; message: string }
  // Every run emits exactly one result trace, after its final state is recorded.
  | { kind: 'result'; status: TerminalTestStatus };

export type SkillTestTraceInput = TraceBody;
export type SkillTestTrace = TraceBody & { id: string; timestamp: string };

export type AssertionResult = {
  label: string;
  passed: boolean;
};

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
  toolPreset?: ToolPreset;
  // Status describes the Claude process only. Assertion outcomes are reported separately.
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
  assertions: AssertionResult[];
};
