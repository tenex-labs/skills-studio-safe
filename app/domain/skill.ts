export const skillScopes = ['personal', 'project'] as const;
export type SkillScope = (typeof skillScopes)[number];

export const findingSeverities = ['error', 'warning', 'info'] as const;
export type FindingSeverity = (typeof findingSeverities)[number];

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  projectId?: string;
  relativePath: string;
  revision: string;
  fileCount: number;
  readOnly: boolean;
  shadowedBy?: string;
  validation: {
    errors: number;
    warnings: number;
  };
};

export type SkillFile = {
  path: string;
  content: string;
  mode: number;
};

export type ValidationFinding = {
  id: string;
  severity: FindingSeverity;
  message: string;
  file?: string;
  line?: number;
};

export type SkillPackage = SkillSummary & {
  files: SkillFile[];
  findings: ValidationFinding[];
};

export type TrustedProject = {
  id: string;
  label: string;
  path: string;
  skillCount: number;
  trustedAt: string;
};
