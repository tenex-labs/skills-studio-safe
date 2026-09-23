import { parseFrontmatter, type SkillFile, type ValidationFinding } from '../../domain/index.ts';

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1_024;
const MAX_SKILL_LINES = 500;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BOOLEAN_FIELDS = new Set(['disable-model-invocation', 'user-invocable', 'background']);
const STRING_FIELDS = new Set([
  'description',
  'when_to_use',
  'argument-hint',
  'model',
  'effort',
  'context',
  'agent',
  'shell',
  'license',
  'compatibility',
]);
const ARRAY_OR_STRING_FIELDS = new Set(['arguments', 'allowed-tools', 'disallowed-tools', 'paths']);
const OBJECT_FIELDS = new Set(['hooks', 'metadata']);
const SUPPORTED_FIELDS = new Set([
  'name',
  'description',
  ...BOOLEAN_FIELDS,
  ...STRING_FIELDS,
  ...ARRAY_OR_STRING_FIELDS,
  ...OBJECT_FIELDS,
]);

export type SkillValidationInput = {
  directoryName: string;
  files: readonly SkillFile[];
};

export type SkillValidationResult = {
  metadata?: Record<string, unknown>;
  findings: ValidationFinding[];
  valid: boolean;
};

function finding(
  id: string,
  severity: ValidationFinding['severity'],
  message: string,
  file = 'SKILL.md',
  line?: number,
): ValidationFinding {
  return { id, severity, message, file, ...(line === undefined ? {} : { line }) };
}

function validateRelativeLinks(files: readonly SkillFile[]): ValidationFinding[] {
  const paths = new Set(files.map((file) => file.path));
  const findings: ValidationFinding[] = [];
  const markdownLink = /!?\[[^\]]*]\(([^)]+)\)/g;

  for (const file of files.filter(({ path }) => path.endsWith('.md'))) {
    for (const match of file.content.matchAll(markdownLink)) {
      const target = match[1]?.trim().replace(/^<|>$/g, '');
      if (
        !target ||
        target.startsWith('#') ||
        /^[a-z][a-z0-9+.-]*:/i.test(target) ||
        target.startsWith('/')
      ) {
        continue;
      }
      let decoded: string;
      try {
        decoded = decodeURIComponent(target.split('#', 1)[0] ?? '');
      } catch {
        findings.push(
          finding('link-invalid-escape', 'error', 'Relative link has invalid escaping.', file.path),
        );
        continue;
      }
      const segments = decoded.replaceAll('\\', '/').split('/');
      if (segments.includes('..') || decoded.includes('\0')) {
        findings.push(
          finding(
            'link-traversal',
            'error',
            'Relative link must stay inside the skill package.',
            file.path,
          ),
        );
        continue;
      }
      const base = file.path.includes('/')
        ? file.path.slice(0, file.path.lastIndexOf('/') + 1)
        : '';
      if (decoded && !paths.has(`${base}${decoded}`)) {
        findings.push(
          finding('link-broken', 'warning', 'Relative link does not resolve.', file.path),
        );
      }
    }
  }
  return findings;
}

export function validateSkillPackage(input: SkillValidationInput): SkillValidationResult {
  const skill = input.files.find(({ path }) => path === 'SKILL.md');
  const findings: ValidationFinding[] = [];
  let metadata: Record<string, unknown> | undefined;

  if (!skill) {
    findings.push(finding('skill-file-missing', 'error', 'SKILL.md is required.'));
  } else {
    const parsed = parseFrontmatter(skill.content);
    if (parsed.status === 'missing') {
      findings.push(
        finding('frontmatter-missing', 'error', 'YAML frontmatter is required.', 'SKILL.md', 1),
      );
    } else if (parsed.status === 'invalid-yaml') {
      findings.push(
        finding('frontmatter-yaml', 'error', 'YAML frontmatter is invalid.', 'SKILL.md', 2),
      );
    } else if (parsed.status === 'not-an-object') {
      findings.push(
        finding(
          'frontmatter-object',
          'error',
          'YAML frontmatter must be an object.',
          'SKILL.md',
          2,
        ),
      );
    } else {
      metadata = parsed.metadata;
    }

    const lineCount = skill.content.split(/\r?\n/).length;
    if (lineCount > MAX_SKILL_LINES) {
      findings.push(
        finding(
          'skill-line-budget',
          'warning',
          `SKILL.md exceeds the ${MAX_SKILL_LINES}-line budget.`,
          'SKILL.md',
          MAX_SKILL_LINES + 1,
        ),
      );
    }
  }

  if (metadata) {
    const name = metadata.name;
    const description = metadata.description;
    if (name !== undefined && (typeof name !== 'string' || name.length === 0)) {
      findings.push(finding('name-invalid-type', 'error', 'Frontmatter name must be a string.'));
    } else if (typeof name === 'string') {
      if (name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
        findings.push(
          finding(
            'name-invalid',
            'error',
            `Name must use lowercase letters, numbers, and single hyphens (maximum ${MAX_NAME_LENGTH}).`,
          ),
        );
      }
      if (name !== input.directoryName) {
        findings.push(
          finding(
            'directory-name-mismatch',
            'warning',
            'Skill name does not match its directory name.',
          ),
        );
      }
    }
    if (description === undefined) {
      findings.push(
        finding(
          'description-recommended',
          'warning',
          'Add a description so Claude can discover when to use this skill.',
        ),
      );
    } else if (typeof description !== 'string' || description.trim().length === 0) {
      findings.push(
        finding('description-invalid', 'error', 'Description must be a non-empty string.'),
      );
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      findings.push(
        finding(
          'description-too-long',
          'error',
          `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
        ),
      );
    }

    for (const [key, value] of Object.entries(metadata)) {
      if (!SUPPORTED_FIELDS.has(key)) {
        findings.push(
          finding(`field-unsupported-${key}`, 'warning', `Unsupported Claude field "${key}".`),
        );
      } else if (BOOLEAN_FIELDS.has(key) && typeof value !== 'boolean') {
        findings.push(finding(`field-type-${key}`, 'error', `"${key}" must be a boolean.`));
      } else if (STRING_FIELDS.has(key) && typeof value !== 'string') {
        findings.push(finding(`field-type-${key}`, 'error', `"${key}" must be a string.`));
      } else if (
        ARRAY_OR_STRING_FIELDS.has(key) &&
        typeof value !== 'string' &&
        !(Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
      ) {
        findings.push(
          finding(`field-type-${key}`, 'error', `"${key}" must be a string or string array.`),
        );
      } else if (
        OBJECT_FIELDS.has(key) &&
        (!value || typeof value !== 'object' || Array.isArray(value))
      ) {
        findings.push(finding(`field-type-${key}`, 'error', `"${key}" must be an object.`));
      }
    }

    if (typeof metadata.compatibility === 'string' && metadata.compatibility.length > 500) {
      findings.push(
        finding('compatibility-too-long', 'error', 'Compatibility must be at most 500 characters.'),
      );
    }
    if (
      typeof metadata.effort === 'string' &&
      !['low', 'medium', 'high', 'xhigh', 'max'].includes(metadata.effort)
    ) {
      findings.push(
        finding('effort-invalid', 'error', 'Effort must be low, medium, high, xhigh, or max.'),
      );
    }
    if (typeof metadata.context === 'string' && metadata.context !== 'fork') {
      findings.push(finding('context-invalid', 'error', 'Context must be "fork".'));
    }
    if (typeof metadata.shell === 'string' && !['bash', 'powershell'].includes(metadata.shell)) {
      findings.push(finding('shell-invalid', 'error', 'Shell must be bash or powershell.'));
    }
    if (metadata.background !== undefined && metadata.context !== 'fork') {
      findings.push(
        finding(
          'background-without-fork',
          'warning',
          'Background only applies with context: fork.',
        ),
      );
    }
  }

  findings.push(...validateRelativeLinks(input.files));
  return {
    ...(metadata ? { metadata } : {}),
    findings,
    valid: !findings.some(({ severity }) => severity === 'error'),
  };
}
