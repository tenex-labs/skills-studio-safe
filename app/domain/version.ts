import type { SkillFile } from './skill';

export type SkillVersion = {
  id: string;
  skillId: string;
  parentVersionId?: string;
  revision: string;
  label: string;
  note?: string;
  createdAt: string;
  source: 'filesystem' | 'draft';
  files: SkillFile[];
};
