import { describe, expect, it } from 'vitest';

import { validateSkillPackage } from '../../../app/backend/catalog/validator.ts';
import type { SkillFile } from '../../../app/domain/index.ts';

function file(content: string, path = 'SKILL.md'): SkillFile {
  return { path, content, mode: 0o644 };
}

describe('validateSkillPackage', () => {
  it('validates required Claude frontmatter and basic field types', () => {
    const result = validateSkillPackage({
      directoryName: 'example',
      files: [
        file(`---
name: Bad Name
description: ""
disable-model-invocation: no
unknown-field: value
---
# Example
`),
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.findings.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'name-invalid',
        'directory-name-mismatch',
        'description-invalid',
        'field-type-disable-model-invocation',
        'field-unsupported-unknown-field',
      ]),
    );
  });

  it('reports package traversal, broken escaping, and unresolved relative links', () => {
    const result = validateSkillPackage({
      directoryName: 'example',
      files: [
        file(`---
name: example
description: Example
---
[escape](../outside.md)
[bad](broken%ZZ.md)
[missing](missing.md)
`),
      ],
    });

    expect(result.findings.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['link-traversal', 'link-invalid-escape', 'link-broken']),
    );
  });

  it('accepts optional names and current Claude skill fields', () => {
    const result = validateSkillPackage({
      directoryName: 'example',
      files: [
        file(`---
description: Example skill
when_to_use: Use for examples
arguments: [file, format]
allowed-tools: Read
disallowed-tools: [Write, Edit]
model: sonnet
effort: high
context: fork
agent: Explore
background: false
paths: ["**/*.md"]
shell: bash
metadata:
  owner: docs
license: MIT
compatibility: Claude Code
---
# Example
`),
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
