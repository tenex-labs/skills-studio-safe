export type StudioReadiness = {
  claude: {
    available: boolean;
    authenticated: boolean;
    version?: string;
  };
  authLogin?: {
    state: 'idle' | 'running' | 'completed' | 'failed';
    finishedAt?: string;
  };
  database: 'ready' | 'error';
  personalSkillsRoot: 'ready' | 'missing';
  activeTests: number;
};
