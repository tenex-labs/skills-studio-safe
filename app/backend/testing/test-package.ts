import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

import { splitFrontmatter, type SkillFile } from '../../domain/index.ts';
import { StudioValidationError } from '../errors.ts';

const MAX_FILES = 100;
const MAX_FILE_LENGTH = 1_000_000;
const MAX_PACKAGE_LENGTH = 5_000_000;

/** Where a test run's copy of the skill lives. The default writes to a private temp directory. */
export interface SkillRunnerFileSystem {
  createTempProject(): Promise<string>;
  writeSkillFile(
    projectDirectory: string,
    commandName: string,
    relativePath: string,
    content: string,
    mode: number,
  ): Promise<void>;
  cleanup(projectDirectory: string): Promise<void>;
}

export const tempDirectoryFileSystem: SkillRunnerFileSystem = {
  async createTempProject() {
    const directory = await mkdtemp(join(tmpdir(), 'claude-skill-studio-'));
    await chmod(directory, 0o700);
    return directory;
  },
  async writeSkillFile(projectDirectory, commandName, relativePath, content, mode) {
    const skillRoot = resolve(projectDirectory, '.claude', 'skills', commandName);
    const destination = resolve(skillRoot, ...relativePath.split('/'));
    const offset = relative(skillRoot, destination);
    if (!offset || offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
      throw new Error('Skill file resolved outside its temporary skill directory');
    }
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, content, { mode: mode & 0o777 });
  },
  async cleanup(projectDirectory) {
    await rm(projectDirectory, { recursive: true, force: true });
  },
};

function validateRelativePath(path: string): void {
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path === '..' ||
    path.startsWith('../')
  ) {
    throw new StudioValidationError('Skill files must use normalized relative paths');
  }
}

function validateLimits(files: readonly SkillFile[]): void {
  if (files.length === 0 || files.length > MAX_FILES) {
    throw new StudioValidationError(`Skill package must contain between 1 and ${MAX_FILES} files`);
  }
  let packageLength = 0;
  const paths = new Set<string>();
  for (const file of files) {
    validateRelativePath(file.path);
    if (file.content.length > MAX_FILE_LENGTH) {
      throw new StudioValidationError('Skill files must be at most 1,000,000 characters');
    }
    if (!Number.isInteger(file.mode) || file.mode < 0) {
      throw new StudioValidationError('Skill file modes must be non-negative integers');
    }
    if (paths.has(file.path)) {
      throw new StudioValidationError('Skill package file paths must be unique');
    }
    paths.add(file.path);
    packageLength += file.content.length;
  }
  if (packageLength > MAX_PACKAGE_LENGTH) {
    throw new StudioValidationError('Skill package must be at most 5,000,000 characters');
  }
}

/**
 * Returns a copy of the package whose SKILL.md is renamed to `commandName`. Each run gets a unique
 * command so it can never collide with the user's installed skill of the same name.
 */
export function prepareTestPackage(files: readonly SkillFile[], commandName: string): SkillFile[] {
  validateLimits(files);
  const manifest = files.find(({ path }) => path === 'SKILL.md');
  if (!manifest) throw new StudioValidationError('Skill package must contain a root SKILL.md');
  const frontmatter = splitFrontmatter(manifest.content);
  if (!frontmatter) throw new StudioValidationError('SKILL.md must contain YAML frontmatter');

  const renamed = /^name:\s*.*$/m.test(frontmatter.source)
    ? frontmatter.block.replace(/^name:\s*.*$/m, `name: ${commandName}`)
    : frontmatter.block.replace(/^---\r?\n/, `---\nname: ${commandName}\n`);
  return files.map((file) =>
    file === manifest ? { ...file, content: `${renamed}${frontmatter.body}` } : { ...file },
  );
}
