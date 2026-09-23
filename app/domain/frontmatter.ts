import { parseDocument } from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export type FrontmatterBlock = {
  /** The complete fenced block, including both `---` lines. */
  block: string;
  /** The YAML between the fences. */
  source: string;
  /** Everything after the block. */
  body: string;
};

export function splitFrontmatter(content: string): FrontmatterBlock | undefined {
  const match = content.match(FRONTMATTER);
  if (!match) return undefined;
  return { block: match[0], source: match[1] ?? '', body: content.slice(match[0].length) };
}

export type ParsedFrontmatter =
  | { status: 'missing' }
  | { status: 'invalid-yaml' }
  | { status: 'not-an-object' }
  | { status: 'ok'; metadata: Record<string, unknown> };

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const split = splitFrontmatter(content);
  if (!split) return { status: 'missing' };
  const document = parseDocument(split.source);
  if (document.errors.length > 0) return { status: 'invalid-yaml' };
  const value: unknown = document.toJS();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'not-an-object' };
  }
  return { status: 'ok', metadata: value as Record<string, unknown> };
}
