export type StudioReadiness = {
  claude: {
    available: boolean;
    authenticated: boolean;
    version?: string;
  };
  database: 'ready' | 'error';
  personalSkillsRoot: 'ready' | 'missing';
  activeTests: number;
};
