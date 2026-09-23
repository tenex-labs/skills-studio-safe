import type { AssertionResult, SkillTestCase } from './testing';

/** Assertions run once, against the final output. Partial traces are never evaluated. */
export function evaluateAssertions(
  testCase: SkillTestCase | undefined,
  output: string,
): AssertionResult[] {
  if (!testCase) return [];
  return [
    ...testCase.expectedContains.map((expected) => ({
      label: `Output contains "${expected}"`,
      passed: output.includes(expected),
    })),
    ...testCase.expectedExcludes.map((excluded) => ({
      label: `Output excludes "${excluded}"`,
      passed: !output.includes(excluded),
    })),
  ];
}
