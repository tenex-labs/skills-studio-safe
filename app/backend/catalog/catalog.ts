import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import type {
  SkillFile,
  SkillPackage,
  SkillSummary,
  SkillVersion,
  TrustedProject,
} from '../../domain/index.ts';
import { StudioDatabase } from '../versions/database.ts';
import { validateSkillPackage } from './validator.ts';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 128;

export class StudioNotFoundError extends Error {}
export class StudioValidationError extends Error {}
export class RevisionConflictError extends Error {
  constructor(readonly currentRevision: string) {
    super('The skill changed since this draft was created.');
  }
}

export type CatalogOptions = {
  database: StudioDatabase;
  personalRoot?: string;
  now?: () => string;
  id?: () => string;
};

export type RegisterProjectInput = { path: string; label?: string; trust: true };
export type CreateDraftInput = {
  skillId: string;
  baseRevision: string;
  files: SkillFile[];
  label: string;
  note?: string;
};
export type PromoteInput = {
  skillId: string;
  versionId: string;
  baseRevision: string;
  capability: string;
};
export type PackageDiff = {
  added: string[];
  modified: string[];
  deleted: string[];
};
export type PromotionResult = {
  skill: SkillPackage;
  version: SkillVersion;
  diff: PackageDiff;
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
  reserved: boolean,
): SkillPackage {
  const validation = validateSkillPackage({
    directoryName: basename(identity.relativePath),
    files: packageData.files,
    reserved,
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

function diffFiles(current: readonly SkillFile[], next: readonly SkillFile[]): PackageDiff {
  const oldFiles = new Map(current.map((file) => [file.path, file]));
  const newFiles = new Map(next.map((file) => [file.path, file]));
  return {
    added: [...newFiles.keys()].filter((path) => !oldFiles.has(path)).sort(),
    modified: [...newFiles.keys()]
      .filter((path) => {
        const old = oldFiles.get(path);
        const nextFile = newFiles.get(path);
        return old && nextFile && (old.content !== nextFile.content || old.mode !== nextFile.mode);
      })
      .sort(),
    deleted: [...oldFiles.keys()].filter((path) => !newFiles.has(path)).sort(),
  };
}

async function writePackageAtomically(
  packagePath: string,
  files: readonly SkillFile[],
): Promise<void> {
  for (const file of files) {
    if (!safeRelativePath(file.path))
      throw new StudioValidationError('Version contains an invalid file path.');
  }
  const parent = dirname(packagePath);
  const token = randomUUID();
  const staging = join(parent, `.skill-staging-${token}`);
  const backup = join(parent, `.skill-backup-${token}`);
  let movedOriginal = false;
  await mkdir(staging, { recursive: false });
  try {
    for (const file of files) {
      const target = resolve(staging, file.path);
      if (!contained(staging, target))
        throw new StudioValidationError('Version contains an invalid file path.');
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
      await chmod(target, file.mode & 0o777);
    }
    await rename(packagePath, backup);
    movedOriginal = true;
    await rename(staging, packagePath);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (movedOriginal) {
      await rm(packagePath, { recursive: true, force: true });
      await rename(backup, packagePath);
    }
    throw error;
  }
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
    if (existing) return existing;
    const project: TrustedProject = {
      id: `project_${hash(canonical).slice(0, 24)}`,
      label: input.label?.trim() || basename(canonical),
      path: canonical,
      skillCount: 0,
      trustedAt: this.now(),
    };
    this.database.saveTrustedProject(project);
    return project;
  }

  listProjects(): TrustedProject[] {
    return this.database.listTrustedProjects();
  }

  removeProject(id: string, capability: string): boolean {
    if (!capability) throw new StudioValidationError('Mutation capability is required.');
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
      let canonicalPackage: string;
      try {
        const lexicalPackage = await lstat(packagePath);
        canonicalPackage = await realpath(packagePath);
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
      const id = `skill_${hash(`${scope}\0${projectId ?? ''}\0${relativePath}`).slice(0, 32)}`;
      packages.push({
        package: summarize(
          { id, scope, ...(projectId ? { projectId } : {}), relativePath },
          packageData,
          canonicalPackage.includes(`${sep}.tenex${sep}skills${sep}`),
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
        if (personal) {
          item.package.shadowedBy = personal;
          item.package.findings.push({
            id: 'personal-skill-shadow',
            severity: 'warning',
            message: 'A personal skill with this command name takes precedence.',
          });
          item.package.validation.warnings += 1;
        }
      }
      this.database.saveSkill(item.package, item.packagePath);
      this.importBaseline(item.package);
    }
    return discovered.map(({ package: skill }) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      scope: skill.scope,
      ...(skill.projectId ? { projectId: skill.projectId } : {}),
      relativePath: skill.relativePath,
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
      (await realpath(record.packagePath)).includes(`${sep}.tenex${sep}skills${sep}`),
    );
    skill.shadowedBy = record.summary.shadowedBy;
    if (skill.shadowedBy) {
      skill.findings.push({
        id: 'personal-skill-shadow',
        severity: 'warning',
        message: 'A personal skill with this command name takes precedence.',
      });
      skill.validation.warnings += 1;
    }
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

  async versionDiff(skillId: string, versionId: string): Promise<PackageDiff> {
    const version = this.database.getVersion(versionId);
    if (!version || version.skillId !== skillId) {
      throw new StudioNotFoundError('Skill version not found.');
    }
    const current = await this.getSkill(skillId);
    return diffFiles(current.files, version.files);
  }

  createDraft(input: CreateDraftInput, capability: string): SkillVersion {
    if (!capability) throw new StudioValidationError('Mutation capability is required.');
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

  async promote(input: PromoteInput): Promise<PromotionResult> {
    if (!input.capability) throw new StudioValidationError('Mutation capability is required.');
    const record = this.database.getSkillRecord(input.skillId);
    const version = this.database.getVersion(input.versionId);
    if (!record || !version || version.skillId !== input.skillId) {
      throw new StudioNotFoundError('Skill version not found.');
    }
    if (record.summary.readOnly)
      throw new StudioValidationError('Read-only skills cannot be promoted.');
    const current = await this.getSkill(input.skillId);
    if (current.revision !== input.baseRevision) throw new RevisionConflictError(current.revision);
    const validation = this.validate(version.files, basename(record.summary.relativePath));
    if (!validation.valid)
      throw new StudioValidationError('Skill version must pass validation before promotion.');
    const diff = diffFiles(current.files, version.files);
    await writePackageAtomically(record.packagePath, version.files);
    const promotedSkill = await this.getSkill(input.skillId);
    this.database.saveSkill(promotedSkill, record.packagePath);
    const promoted = this.database.saveVersion({
      id: this.newId(),
      skillId: input.skillId,
      parentVersionId: version.id,
      revision: promotedSkill.revision,
      label: `Promoted: ${version.label}`,
      ...(version.note ? { note: version.note } : {}),
      createdAt: this.now(),
      source: 'promoted',
      files: promotedSkill.files,
    });
    return { skill: promotedSkill, version: promoted, diff };
  }
}
