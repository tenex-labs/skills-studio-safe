import { describe, expect, it } from 'vitest';

import { prepareTestPackage } from '../../../app/backend/testing/test-package.ts';
import type { SkillFile } from '../../../app/domain/index.ts';

const manifest = (content: string): SkillFile => ({ path: 'SKILL.md', content, mode: 0o644 });

describe('prepareTestPackage', () => {
  it('renames the command without changing the body or the source files', () => {
    const files = [manifest('---\nname: original\ndescription: Test\n---\nBody\n')];
    const prepared = prepareTestPackage(files, 'skill-test-1');

    expect(prepared[0]!.content).toBe('---\nname: skill-test-1\ndescription: Test\n---\nBody\n');
    expect(files[0]!.content).toContain('name: original');
  });

  it('adds a name when the frontmatter has none', () => {
    const [prepared] = prepareTestPackage([manifest('---\ndescription: Test\n---\n')], 'cmd');
    expect(prepared!.content).toBe('---\nname: cmd\ndescription: Test\n---\n');
  });

  it('rejects packages without a manifest, frontmatter, or safe paths', () => {
    expect(() => prepareTestPackage([], 'cmd')).toThrow('between 1 and 100 files');
    expect(() => prepareTestPackage([manifest('No frontmatter')], 'cmd')).toThrow(
      'YAML frontmatter',
    );
    expect(() =>
      prepareTestPackage([{ path: 'notes.md', content: '', mode: 0o644 }], 'cmd'),
    ).toThrow('root SKILL.md');
    expect(() =>
      prepareTestPackage(
        [manifest('---\nname: x\n---\n'), { path: 'a/../../b.md', content: '', mode: 0o644 }],
        'cmd',
      ),
    ).toThrow('normalized relative paths');
  });
});
