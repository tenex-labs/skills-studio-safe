import { describe, expect, it } from 'vitest';

import { evaluateAssertions } from '../../app/domain/assertions.ts';
import type { SkillTestCase } from '../../app/domain/index.ts';

const testCase: SkillTestCase = {
  id: 'case-1',
  skillId: 'skill-1',
  name: 'Case',
  prompt: 'Prompt',
  expectedContains: ['naïve café'],
  expectedExcludes: ['TODO'],
  createdAt: '2026-09-22T12:00:00.000Z',
};

describe('evaluateAssertions', () => {
  it('returns nothing when the run has no test case', () => {
    expect(evaluateAssertions(undefined, 'anything')).toEqual([]);
  });

  it('evaluates contains and excludes against the final output, including Unicode', () => {
    expect(evaluateAssertions(testCase, 'A naïve café review.')).toEqual([
      { label: 'Output contains "naïve café"', passed: true },
      { label: 'Output excludes "TODO"', passed: true },
    ]);
  });

  it('fails a contains assertion and passes an excludes assertion on empty output', () => {
    expect(evaluateAssertions(testCase, '')).toEqual([
      { label: 'Output contains "naïve café"', passed: false },
      { label: 'Output excludes "TODO"', passed: true },
    ]);
  });
});
