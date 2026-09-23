import type { SkillPackage, SkillTestRun, SkillVersion, TrustedProject } from '../../domain/index';

const skillMarkdown = `---
name: code-review
description: Review a change for consequential correctness problems.
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
    available: true,
    skillCount: 1,
    trustedAt: '2026-09-22T12:00:00Z',
  },
];

// The same command name exists in both scopes, so the personal skill wins and the project copy is
// shadowed. This mirrors how the real catalog reports precedence.
export const demoSkills: SkillPackage[] = [
  {
    id: 'demo-personal-review',
    name: 'code-review',
    description: 'Review code changes and return prioritized findings.',
    scope: 'personal',
    relativePath: 'code-review',
    revision: 'filesystem:1',
    fileCount: 2,
    readOnly: false,
    validation: { errors: 0, warnings: 0 },
    files: [
      { path: 'SKILL.md', content: skillMarkdown, mode: 420 },
      {
        path: 'references/checklist.md',
        content: '# Checklist\n\n- Correctness\n- Data integrity\n- Verification\n',
        mode: 420,
      },
    ],
    findings: [],
  },
  {
    id: 'demo-project-review',
    name: 'code-review',
    description: 'Project-specific review guidance.',
    scope: 'project',
    projectId: 'demo-project',
    relativePath: 'code-review',
    revision: 'filesystem:2',
    fileCount: 1,
    readOnly: true,
    shadowedBy: 'demo-personal-review',
    validation: { errors: 0, warnings: 1 },
    files: [
      {
        path: 'SKILL.md',
        content: skillMarkdown.replace('Lead with findings.', 'Lead with project risks.'),
        mode: 420,
      },
    ],
    findings: [
      {
        id: 'personal-skill-shadow',
        severity: 'warning',
        message: 'A personal skill with this command name takes precedence.',
      },
    ],
  },
];

export const demoVersions: SkillVersion[] = [
  {
    id: 'demo-version-current',
    skillId: 'demo-personal-review',
    parentVersionId: 'demo-version-baseline',
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
    label: 'Filesystem baseline',
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

export const demoRuns: SkillTestRun[] = [
  {
    id: 'demo-run',
    skillId: 'demo-personal-review',
    versionId: 'demo-version-current',
    prompt: 'Review a change that dereferences an optional user profile.',
    model: 'sonnet',
    effort: 'high',
    toolPreset: 'none',
    status: 'passed',
    startedAt: '2026-09-22T13:31:00Z',
    finishedAt: '2026-09-22T13:31:03Z',
    durationMs: 3100,
    output: 'The optional profile is dereferenced before its presence is checked.',
    usage: { inputTokens: 410, outputTokens: 82, costUsd: 0.0031 },
    assertions: [],
  },
];
