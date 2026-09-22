import type {
  SkillPackage,
  SkillTestCase,
  SkillTestRun,
  SkillVersion,
  TrustedProject,
} from '../../domain/index';

const skillMarkdown = `---
name: code-review
description: Review a change for consequential correctness problems.
version: 1.2.0
---

# Code Review

Inspect the complete change before reporting findings.

## Output

- Lead with findings.
- Cite the affected file.
- Say when no consequential issue was found.
`;

export const demoProjects: TrustedProject[] = [
  {
    id: 'demo-project',
    label: 'Workshop project',
    path: '/trusted/workshop-project',
    skillCount: 1,
    trustedAt: '2026-09-22T12:00:00Z',
  },
];

export const demoSkills: SkillPackage[] = [
  {
    id: 'demo-personal-review',
    name: 'code-review',
    description: 'Review code changes and return prioritized findings.',
    scope: 'personal',
    relativePath: 'code-review/SKILL.md',
    revision: 'filesystem:1',
    fileCount: 2,
    readOnly: false,
    shadowedBy: 'Workshop project',
    validation: { errors: 0, warnings: 1 },
    files: [
      { path: 'SKILL.md', content: skillMarkdown, mode: 420 },
      {
        path: 'references/checklist.md',
        content: '# Checklist\n\n- Correctness\n- Data integrity\n- Verification\n',
        mode: 420,
      },
    ],
    findings: [
      {
        id: 'demo-warning',
        severity: 'warning',
        message: 'Description is longer than the recommended catalog summary.',
        file: 'SKILL.md',
        line: 3,
      },
    ],
  },
  {
    id: 'demo-project-review',
    name: 'code-review',
    description: 'Project-specific review guidance.',
    scope: 'project',
    projectId: 'demo-project',
    relativePath: '.claude/skills/code-review/SKILL.md',
    revision: 'filesystem:2',
    fileCount: 1,
    readOnly: true,
    validation: { errors: 0, warnings: 0 },
    files: [{ path: 'SKILL.md', content: skillMarkdown.replace('1.2.0', '1.3.0'), mode: 420 }],
    findings: [],
  },
];

export const demoVersions: SkillVersion[] = [
  {
    id: 'demo-version-current',
    skillId: 'demo-personal-review',
    revision: 'draft:2',
    label: 'Current workshop draft',
    note: 'Tightened finding quality.',
    createdAt: '2026-09-22T13:15:00Z',
    source: 'draft',
    files: demoSkills[0].files,
  },
  {
    id: 'demo-version-baseline',
    skillId: 'demo-personal-review',
    revision: 'filesystem:1',
    label: 'Installed baseline',
    note: 'Imported from the personal skill root.',
    createdAt: '2026-09-22T12:00:00Z',
    source: 'filesystem',
    files: demoSkills[0].files.map((file) =>
      file.path === 'SKILL.md'
        ? { ...file, content: file.content.replace('Lead with findings.', 'Summarize the change.') }
        : file,
    ),
  },
];

export const demoTestCases: SkillTestCase[] = [
  {
    id: 'demo-case',
    skillId: 'demo-personal-review',
    name: 'Find a null handling bug',
    prompt: 'Review a change that dereferences an optional user profile.',
    expectedContains: ['profile'],
    expectedExcludes: ['Looks good'],
    createdAt: '2026-09-22T13:30:00Z',
  },
];

export const demoRuns: SkillTestRun[] = [
  {
    id: 'demo-run',
    skillId: 'demo-personal-review',
    versionId: 'demo-version-current',
    testCaseId: 'demo-case',
    prompt: demoTestCases[0].prompt,
    model: 'sonnet',
    status: 'passed',
    startedAt: '2026-09-22T13:31:00Z',
    finishedAt: '2026-09-22T13:31:03Z',
    durationMs: 3100,
    output: 'The optional profile is dereferenced before its presence is checked.',
    usage: { inputTokens: 410, outputTokens: 82, costUsd: 0.0031 },
    assertions: [{ label: 'Contains “profile”', passed: true }],
  },
];
