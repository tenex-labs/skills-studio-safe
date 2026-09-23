import { describe, expect, it } from 'vitest';

import { parseFrontmatter, splitFrontmatter } from '../../app/domain/frontmatter.ts';

describe('frontmatter', () => {
  it('splits the fenced block from the body', () => {
    expect(splitFrontmatter('---\nname: a\n---\nBody')).toEqual({
      block: '---\nname: a\n---\n',
      source: 'name: a',
      body: 'Body',
    });
    expect(splitFrontmatter('Body only')).toBeUndefined();
  });

  it('parses YAML values, including quoted strings', () => {
    expect(parseFrontmatter('---\nname: "a"\ndescription: \'It: works\'\n---\n')).toEqual({
      status: 'ok',
      metadata: { name: 'a', description: 'It: works' },
    });
  });

  it('distinguishes missing, invalid, and non-object frontmatter', () => {
    expect(parseFrontmatter('# Title')).toEqual({ status: 'missing' });
    expect(parseFrontmatter('---\nname: [unclosed\n---\n')).toEqual({ status: 'invalid-yaml' });
    expect(parseFrontmatter('---\n- a\n- b\n---\n')).toEqual({ status: 'not-an-object' });
  });
});
