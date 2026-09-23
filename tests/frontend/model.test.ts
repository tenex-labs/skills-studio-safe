import { describe, expect, it } from 'vitest';
import type { SkillSummary } from '../../app/domain/index';
import { demoSkills } from '../../app/frontend/fixtures/demo';
import {
  conflictLabel,
  filesAreDirty,
  filterCatalog,
  packageDiffSummary,
  parseSkillMetadata,
  updateFile,
  validationLabel,
} from '../../app/frontend/model/skill-view-model';

const catalog: SkillSummary[] = demoSkills;

describe('skill catalog projections', () => {
  it('filters catalog content without losing conflict information', () => {
    expect(filterCatalog(catalog, 'PROJECT')).toEqual([demoSkills[1]]);
    expect(filterCatalog(catalog, 'review')).toHaveLength(2);
    expect(conflictLabel(demoSkills[0])).toBe('Shadowed by Workshop project');
    expect(conflictLabel(demoSkills[1])).toBe('No conflicts');
  });

  it('renders validation counts honestly', () => {
    expect(validationLabel({ errors: 0, warnings: 0 })).toBe('Valid');
    expect(validationLabel({ errors: 0, warnings: 2 })).toBe('2 warnings');
    expect(validationLabel({ errors: 1, warnings: 4 })).toBe('1 error');
  });
});

describe('editor working copies', () => {
  it('tracks dirty files and summarizes an immutable draft diff', () => {
    const original = demoSkills[0].files;
    const edited = updateFile(original, 'SKILL.md', `${original[0].content}\nNew guidance.`);

    expect(filesAreDirty(original, edited)).toBe(true);
    expect(filesAreDirty(edited, edited)).toBe(false);
    expect(packageDiffSummary(original, edited)).toBe('1 changed file: SKILL.md');
  });

  it('parses the SKILL.md metadata summary', () => {
    expect(parseSkillMetadata(demoSkills[0].files[0].content)).toMatchObject({
      name: 'code-review',
      description: 'Review a change for consequential correctness problems.',
    });
  });
});
