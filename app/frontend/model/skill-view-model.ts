import type { SkillFile, SkillSummary, SkillTestRun, StudioReadiness } from '../../domain/index';

export type LoadState = 'loading' | 'ready' | 'error';
export type StudioView = 'library' | 'editor' | 'test-lab';

export const unavailableReadiness: StudioReadiness = {
  claude: { available: false, authenticated: false },
  database: 'error',
  personalSkillsRoot: 'missing',
  activeTests: 0,
};

export function filterCatalog(skills: SkillSummary[], query: string): SkillSummary[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return skills;
  return skills.filter((skill) =>
    [skill.name, skill.description, skill.relativePath, skill.scope].some((value) =>
      value.toLocaleLowerCase().includes(normalized),
    ),
  );
}

export function conflictLabel(skill: SkillSummary): string {
  return skill.shadowedBy ? `Shadowed by ${skill.shadowedBy}` : 'No conflicts';
}

export function validationLabel(validation: SkillSummary['validation']): string {
  if (validation.errors > 0) {
    return `${validation.errors} error${validation.errors === 1 ? '' : 's'}`;
  }
  if (validation.warnings > 0) {
    return `${validation.warnings} warning${validation.warnings === 1 ? '' : 's'}`;
  }
  return 'Valid';
}

export function updateFile(files: SkillFile[], path: string, content: string): SkillFile[] {
  return files.map((file) => (file.path === path ? { ...file, content } : file));
}

export function filesAreDirty(original: SkillFile[], edited: SkillFile[]): boolean {
  if (original.length !== edited.length) return true;
  return original.some((file, index) => {
    const candidate = edited[index];
    return (
      !candidate ||
      candidate.path !== file.path ||
      candidate.content !== file.content ||
      candidate.mode !== file.mode
    );
  });
}

export type SkillMetadata = {
  name?: string;
  description?: string;
  fields: Array<{ key: string; value: string }>;
};

export function parseSkillMetadata(content: string): SkillMetadata {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { fields: [] };
  const end = lines.slice(1).findIndex((line) => line.trim() === '---');
  if (end < 0) return { fields: [] };
  const fields = lines
    .slice(1, end + 1)
    .map((line) => line.match(/^([A-Za-z][\w-]*):\s*(.+)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ key: match[1], value: match[2].replace(/^["']|["']$/g, '') }));
  return {
    name: fields.find(({ key }) => key === 'name')?.value,
    description: fields.find(({ key }) => key === 'description')?.value,
    fields,
  };
}

export function changedFilePaths(base: SkillFile[], next: SkillFile[]): string[] {
  const baseByPath = new Map(base.map((file) => [file.path, file]));
  return next
    .filter((file) => baseByPath.get(file.path)?.content !== file.content)
    .map((file) => file.path);
}

export function packageDiffSummary(base: SkillFile[], next: SkillFile[]): string {
  const changed = changedFilePaths(base, next);
  if (changed.length === 0) return 'No file changes';
  return `${changed.length} changed file${changed.length === 1 ? '' : 's'}: ${changed.join(', ')}`;
}

export function formatDuration(durationMs?: number): string {
  return durationMs === undefined ? 'Unavailable' : `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatTokens(run?: SkillTestRun): string {
  if (
    !run?.usage ||
    (run.usage.inputTokens === undefined && run.usage.outputTokens === undefined)
  ) {
    return 'Unavailable';
  }
  return `${run.usage.inputTokens ?? 0} in / ${run.usage.outputTokens ?? 0} out`;
}

export function formatCost(run?: SkillTestRun): string {
  return run?.usage?.costUsd === undefined ? 'Unavailable' : `$${run.usage.costUsd.toFixed(4)}`;
}
