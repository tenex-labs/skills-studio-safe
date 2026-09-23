export type ClaudeStatus = {
  available: boolean;
  authenticated: boolean;
  version?: string;
};

export type ClaudeLoginState = {
  state: 'idle' | 'running' | 'completed' | 'failed';
  finishedAt?: string;
};

export type StudioReadiness = {
  claude: ClaudeStatus;
  authLogin?: ClaudeLoginState;
  database: 'ready' | 'error';
  personalSkillsRoot: 'ready' | 'missing';
  activeTests: number;
};
