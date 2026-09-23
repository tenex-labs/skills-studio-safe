import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';

import type {
  SkillFile,
  SkillPackage,
  SkillSummary,
  SkillVersion,
  StoredProject,
  TrustedProject,
} from '../../domain/index.ts';
import { RevisionConflictError, StudioNotFoundError, StudioValidationError } from '../errors.ts';
import { StudioDatabase } from '../storage/database.ts';
import { validateSkillPackage } from './validator.ts';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 128;

export type CatalogOptions = {
  database: StudioDatabase;
  personalRoot?: string;
  now?: () => string;
  id?: () => string;
};

export type RegisterProjectInput = { path: string; label?: string; trust: true };
export type CreateSkillInput = {
  scope: SkillSummary['scope'];
  projectId?: string;
  name: string;
  description: string;
};
export type CreateDraftInput = {
  skillId: string;
  baseRevision: string;
  files: SkillFile[];
  label: string;
  note?: string;
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Skill IDs are derived from location rather than stored, so a rescan finds the same skill again.
function skillIdFor(
  scope: SkillSummary['scope'],
  projectId: string | undefined,
  directory: string,
) {
  return `skill_${hash(`${scope}\0${projectId ?? ''}\0${directory}`).slice(0, 32)}`;
}

export function revisionForFiles(files: readonly SkillFile[]): string {
  const digest = createHash('sha256');
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    digest
      .update(file.path)
      .update('\0')
      .update(String(file.mode))
      .update('\0')
      .update(file.content)
      .update('\0');
  }
  return `sha256:${digest.digest('hex')}`;
}

function safeRelativePath(path: string): boolean {
  if (!path || path.includes('\0') || path.startsWith('/') || path.includes('\\')) return false;
  const segments = path.split('/');
  return !segments.some((segment) => !segment || segment === '.' || segment === '..');
}

function contained(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith(sep));
}

function isText(buffer: Buffer): boolean {
  return !buffer.subarray(0, 8_192).includes(0);
}

async function readPackage(
  packagePath: string,
): Promise<{ files: SkillFile[]; readOnly: boolean }> {
  const canonicalPackage = await realpath(packagePath);
  let readOnly = (await lstat(packagePath)).isSymbolicLink();
  const files: SkillFile[] = [];
  let packageBytes = 0;

  async function visit(directory: string, prefix: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (files.length >= MAX_FILES)
        throw new StudioValidationError('Skill package has too many files.');
      const lexicalPath = join(directory, entry.name);
      const canonicalPath = await realpath(lexicalPath);
      if (!contained(canonicalPackage, canonicalPath)) {
        throw new StudioValidationError('Skill package contains a path outside its package.');
      }
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const entryStat = await lstat(lexicalPath);
      if (entryStat.isSymbolicLink()) readOnly = true;
      const targetStat = await stat(lexicalPath);
      if (targetStat.isDirectory()) {
        await visit(lexicalPath, relativePath);
        continue;
      }
      if (!targetStat.isFile()) continue;
      if (targetStat.size > MAX_FILE_BYTES) {
        throw new StudioValidationError('Skill package contains a file that is too large.');
      }
      packageBytes += targetStat.size;
      if (packageBytes > MAX_PACKAGE_BYTES) {
        throw new StudioValidationError('Skill package is too large.');
      }
      const contents = await readFile(lexicalPath);
      if (!isText(contents)) continue;
      files.push({
        path: relativePath,
        content: contents.toString('utf8'),
        mode: targetStat.mode & 0o777,
      });
    }
  }

  await visit(packagePath, '');
  return { files, readOnly };
}

function metadataText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function summarize(
  identity: Pick<SkillSummary, 'id' | 'scope' | 'projectId' | 'relativePath'>,
  packageData: { files: SkillFile[]; readOnly: boolean },
): SkillPackage {
  const validation = validateSkillPackage({
    directoryName: basename(identity.relativePath),
    files: packageData.files,
  });
  const summary: SkillSummary = {
    ...identity,
    name: metadataText(validation.metadata?.name) || basename(identity.relativePath),
    description: metadataText(validation.metadata?.description),
    revision: revisionForFiles(packageData.files),
    fileCount: packageData.files.length,
    readOnly: packageData.readOnly,
    validation: {
      errors: validation.findings.filter(({ severity }) => severity === 'error').length,
      warnings: validation.findings.filter(({ severity }) => severity === 'warning').length,
    },
  };
  return { ...summary, files: packageData.files, findings: validation.findings };
}

// Claude Code resolves a same-name command to the personal skill, so the project copy is shadowed.
function markShadowed(skill: SkillPackage, personalSkillId: string): void {
  skill.shadowedBy = personalSkillId;
  skill.findings.push({
    id: 'personal-skill-shadow',
    severity: 'warning',
    message: 'A personal skill with this command name takes precedence.',
  });
  skill.validation.warnings += 1;
}

export class SkillCatalog {
  readonly database: StudioDatabase;
  readonly personalRoot: string;
  private readonly now: () => string;
  private readonly newId: () => string;

  constructor(options: CatalogOptions) {
    this.database = options.database;
    this.personalRoot = resolve(options.personalRoot ?? join(homedir(), '.claude', 'skills'));
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId = options.id ?? randomUUID;
  }

  async registerProject(input: RegisterProjectInput): Promise<TrustedProject> {
    if (input.trust !== true) throw new StudioValidationError('Explicit trust is required.');
    let canonical: string;
    try {
      canonical = await realpath(resolve(input.path));
      if (!(await stat(canonical)).isDirectory()) throw new Error();
    } catch {
      throw new StudioValidationError('Trusted project must be an existing directory.');
    }
    const existing = this.database
      .listTrustedProjects()
      .find(({ path: registeredPath }) => registeredPath === canonical);
    if (existing) return this.describeProject(existing);
    const project: StoredProject = {
      id: `project_${hash(canonical).slice(0, 24)}`,
      label: input.label?.trim() || basename(canonical),
      path: canonical,
      trustedAt: this.now(),
    };
    this.database.saveTrustedProject(project);
    return this.describeProject(project);
  }

  async listProjects(): Promise<TrustedProject[]> {
    return Promise.all(
      this.database.listTrustedProjects().map((project) => this.describeProject(project)),
    );
  }

  // The stored path can go stale when a folder is moved or deleted, so check it on every read and
  // count skills from disk rather than from catalog rows left by earlier scans.
  private async describeProject(project: StoredProject): Promise<TrustedProject> {
    const available = await stat(project.path).then(
      (entry) => entry.isDirectory(),
      () => false,
    );
    const skillCount = available
      ? (await this.discoverRoot(join(project.path, '.claude', 'skills'), 'project', project.id))
          .length
      : 0;
    return { ...project, available, skillCount };
  }

  async createSkill(input: CreateSkillInput): Promise<SkillPackage> {
    const name = input.name.trim();
    const description = input.description.trim();
    const files: SkillFile[] = [
      {
        path: 'SKILL.md',
        content: `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n\n# ${name}\n`,
        mode: 0o644,
      },
    ];
    const validation = this.validate(files, name);
    if (!validation.valid) throw new StudioValidationError('New skill metadata is invalid.');

    let root: string;
    if (input.scope === 'personal') {
      root = this.personalRoot;
    } else {
      const project = input.projectId
        ? this.database.getTrustedProject(input.projectId)
        : undefined;
      if (!project) throw new StudioValidationError('Choose a trusted project.');
      root = join(project.path, '.claude', 'skills');
    }
    await mkdir(root, { recursive: true });
    const packagePath = join(root, name);
    try {
      await mkdir(packagePath, { recursive: false });
      await writeFile(join(packagePath, 'SKILL.md'), files[0]!.content, { mode: 0o644 });
    } catch {
      throw new StudioValidationError('A skill with this name already exists.');
    }

    const id = skillIdFor(input.scope, input.projectId, name);
    const skill = summarize(
      {
        id,
        scope: input.scope,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        relativePath: name,
      },
      { files, readOnly: false },
    );
    skill.sourcePath = packagePath;
    this.database.saveSkill(skill, packagePath);
    this.importBaseline(skill);
    return skill;
  }

  removeProject(id: string): boolean {
    return this.database.removeTrustedProject(id);
  }

  private async discoverRoot(
    root: string,
    scope: SkillSummary['scope'],
    projectId?: string,
  ): Promise<{ package: SkillPackage; packagePath: string }[]> {
    let canonicalRoot: string;
    try {
      canonicalRoot = await realpath(root);
      if (!(await stat(canonicalRoot)).isDirectory()) return [];
    } catch {
      return [];
    }
    const entries = await readdir(root, { withFileTypes: true });
    const packages: { package: SkillPackage; packagePath: string }[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const packagePath = join(root, entry.name);
      try {
        const lexicalPackage = await lstat(packagePath);
        const canonicalPackage = await realpath(packagePath);
        if (
          ((!lexicalPackage.isSymbolicLink() || scope === 'project') &&
            !contained(canonicalRoot, canonicalPackage)) ||
          !(await stat(packagePath)).isDirectory()
        ) {
          continue;
        }
        if (!(await stat(join(packagePath, 'SKILL.md'))).isFile()) continue;
      } catch {
        continue;
      }
      const packageData = await readPackage(packagePath);
      const relativePath = entry.name;
      const id = skillIdFor(scope, projectId, relativePath);
      packages.push({
        package: summarize(
          { id, scope, ...(projectId ? { projectId } : {}), relativePath },
          packageData,
        ),
        packagePath,
      });
    }
    return packages;
  }

  async discover(): Promise<SkillSummary[]> {
    const discovered = await this.discoverRoot(this.personalRoot, 'personal');
    for (const project of this.database.listTrustedProjects()) {
      discovered.push(
        ...(await this.discoverRoot(
          join(project.path, '.claude', 'skills'),
          'project',
          project.id,
        )),
      );
    }
    const personalByName = new Map(
      discovered
        .filter(({ package: skill }) => skill.scope === 'personal')
        .map(({ package: skill }) => [skill.name, skill.id]),
    );
    for (const item of discovered) {
      if (item.package.scope === 'project') {
        const personal = personalByName.get(item.package.name);
        if (personal) markShadowed(item.package, personal);
      }
      this.database.saveSkill(item.package, item.packagePath);
      this.importBaseline(item.package);
    }
    return discovered.map(({ package: skill, packagePath }) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      scope: skill.scope,
      ...(skill.projectId ? { projectId: skill.projectId } : {}),
      relativePath: skill.relativePath,
      sourcePath: packagePath,
      revision: skill.revision,
      fileCount: skill.fileCount,
      readOnly: skill.readOnly,
      ...(skill.shadowedBy ? { shadowedBy: skill.shadowedBy } : {}),
      validation: skill.validation,
    }));
  }

  async getSkill(id: string): Promise<SkillPackage> {
    const record = this.database.getSkillRecord(id);
    if (!record) throw new StudioNotFoundError('Skill not found.');
    let packageData: { files: SkillFile[]; readOnly: boolean };
    try {
      packageData = await readPackage(record.packagePath);
    } catch {
      throw new StudioNotFoundError('Skill package is unavailable.');
    }
    const skill = summarize(
      {
        id: record.summary.id,
        scope: record.summary.scope,
        ...(record.summary.projectId ? { projectId: record.summary.projectId } : {}),
        relativePath: record.summary.relativePath,
      },
      packageData,
    );
    skill.sourcePath = record.packagePath;
    if (record.summary.shadowedBy) markShadowed(skill, record.summary.shadowedBy);
    return skill;
  }

  validate(files: SkillFile[], directoryName: string) {
    for (const file of files) {
      if (!safeRelativePath(file.path))
        throw new StudioValidationError('Version contains an invalid file path.');
    }
    return validateSkillPackage({ files, directoryName });
  }

  private importBaseline(skill: SkillPackage): SkillVersion {
    return this.database.saveVersion({
      id: this.newId(),
      skillId: skill.id,
      revision: skill.revision,
      label: 'Filesystem baseline',
      createdAt: this.now(),
      source: 'filesystem',
      files: skill.files,
    });
  }

  listVersions(skillId: string): SkillVersion[] {
    if (!this.database.getSkillRecord(skillId)) throw new StudioNotFoundError('Skill not found.');
    return this.database.listVersions(skillId);
  }

  createDraft(input: CreateDraftInput): SkillVersion {
    const skill = this.database.getSkillRecord(input.skillId);
    if (!skill) throw new StudioNotFoundError('Skill not found.');
    this.validate(input.files, basename(skill.summary.relativePath));
    const parent = this.database
      .listVersions(input.skillId)
      .find(({ revision }) => revision === input.baseRevision);
    if (!parent) throw new RevisionConflictError(skill.summary.revision);
    return this.database.saveVersion({
      id: this.newId(),
      skillId: input.skillId,
      parentVersionId: parent.id,
      revision: revisionForFiles(input.files),
      label: input.label,
      ...(input.note ? { note: input.note } : {}),
      createdAt: this.now(),
      source: 'draft',
      files: input.files,
    });
  }
}
