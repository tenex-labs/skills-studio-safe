import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RevisionConflictError, SkillCatalog } from '../../../app/backend/catalog/catalog.ts';
import { StudioDatabase } from '../../../app/backend/versions/database.ts';
import type { SkillFile } from '../../../app/domain/index.ts';

const databases: StudioDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

async function skill(root: string, name: string, description: string): Promise<string> {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`,
  );
  return directory;
}

function catalog(personalRoot: string): SkillCatalog {
  const database = new StudioDatabase(':memory:');
  databases.push(database);
  let nextId = 0;
  return new SkillCatalog({
    database,
    personalRoot,
    now: () => '2026-09-22T12:00:00.000Z',
    id: () => `id-${++nextId}`,
  });
}

describe('SkillCatalog discovery', () => {
  it('only scans direct packages in personal and registered project roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-catalog-'));
    const personal = join(root, 'personal');
    const project = join(root, 'project');
    await skill(personal, 'personal-only', 'Personal');
    await skill(join(personal, 'nested'), 'not-direct', 'Nested');
    await skill(join(project, '.claude', 'skills'), 'project-only', 'Project');
    await skill(join(root, 'unregistered', '.claude', 'skills'), 'hidden', 'Hidden');
    const studio = catalog(personal);
    await studio.registerProject({ path: project, trust: true });

    const discovered = await studio.discover();

    expect(discovered.map(({ name }) => name)).toEqual(['personal-only', 'project-only']);
  });

  it('gives personal commands precedence and reports project shadowing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-precedence-'));
    const personal = join(root, 'personal');
    const project = join(root, 'project');
    await skill(personal, 'same-name', 'Personal');
    await skill(join(project, '.claude', 'skills'), 'same-name', 'Project');
    const studio = catalog(personal);
    await studio.registerProject({ path: project, trust: true });

    const discovered = await studio.discover();
    const personalSkill = discovered.find(({ scope }) => scope === 'personal')!;
    const projectSkill = discovered.find(({ scope }) => scope === 'project')!;
    const detail = await studio.getSkill(projectSkill.id);

    expect(projectSkill.shadowedBy).toBe(personalSkill.id);
    expect(detail.findings).toContainEqual(
      expect.objectContaining({ id: 'personal-skill-shadow', severity: 'warning' }),
    );
  });

  it('allows contained symlink files but marks the package read-only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-symlink-'));
    const personal = join(root, 'personal');
    const directory = await skill(personal, 'linked', 'Linked');
    await writeFile(join(directory, 'source.md'), 'source');
    await symlink(join(directory, 'source.md'), join(directory, 'alias.md'));
    const studio = catalog(personal);

    const [summary] = await studio.discover();
    const detail = await studio.getSkill(summary!.id);

    expect(detail.readOnly).toBe(true);
    expect(detail.files.map(({ path }) => path)).toContain('alias.md');
  });

  it('rejects symlinks that escape the package', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-traversal-'));
    const personal = join(root, 'personal');
    const directory = await skill(personal, 'unsafe', 'Unsafe');
    await writeFile(join(root, 'outside.md'), 'outside');
    await symlink(join(root, 'outside.md'), join(directory, 'outside.md'));
    const studio = catalog(personal);

    await expect(studio.discover()).rejects.toThrow('outside its package');
  });
});

describe('SkillCatalog versions', () => {
  it('deduplicates baselines and saves Studio versions without changing installed files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-versions-'));
    const personal = join(root, 'personal');
    await skill(personal, 'editable', 'Before');
    const studio = catalog(personal);
    const [summary] = await studio.discover();
    await studio.discover();
    const [baseline] = studio.listVersions(summary!.id);
    expect(baseline).toBeDefined();
    expect(studio.listVersions(summary!.id)).toHaveLength(1);

    const files: SkillFile[] = [
      {
        path: 'SKILL.md',
        content: '---\nname: editable\ndescription: After\n---\n# Changed\n',
        mode: 0o644,
      },
      { path: 'notes.md', content: 'new file\n', mode: 0o644 },
    ];
    studio.createDraft(
      {
        skillId: summary!.id,
        baseRevision: summary!.revision,
        files,
        label: 'Edit description',
      },
      'test-capability',
    );

    expect(studio.listVersions(summary!.id)).toHaveLength(2);
    expect(await readFile(join(personal, 'editable', 'SKILL.md'), 'utf8')).toContain(
      'description: Before',
    );
    await expect(readFile(join(personal, 'editable', 'notes.md'), 'utf8')).rejects.toThrow();
    expect(() =>
      studio.createDraft(
        {
          skillId: summary!.id,
          baseRevision: 'missing-revision',
          files,
          label: 'Conflicting draft',
        },
        'test-capability',
      ),
    ).toThrow(RevisionConflictError);
  });
});
