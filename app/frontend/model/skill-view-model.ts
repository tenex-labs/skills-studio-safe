import {
  parseFrontmatter,
  type SkillFile,
  type SkillSummary,
  type SkillTestRun,
  type StudioReadiness,
} from '../../domain/index';

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
  return skill.shadowedBy ? 'Shadowed: a personal skill with this name wins' : 'No conflicts';
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
};

export function parseSkillMetadata(content: string): SkillMetadata {
  const parsed = parseFrontmatter(content);
  if (parsed.status !== 'ok') return {};
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  return { name: text(parsed.metadata.name), description: text(parsed.metadata.description) };
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
