import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { StudioDatabase } from '../../../app/backend/versions/database.ts';

describe('StudioDatabase', () => {
  it('applies explicit migrations and reopens the same schema in WAL mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-database-'));
    const path = join(root, 'studio.sqlite');
    const first = new StudioDatabase(path);

    expect(first.connection.pragma('user_version', { simple: true })).toBe(1);
    expect(first.connection.pragma('journal_mode', { simple: true })).toBe('wal');
    first.close();

    const reopened = new StudioDatabase(path);
    expect(reopened.connection.pragma('user_version', { simple: true })).toBe(1);
    expect(
      reopened.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all(),
    ).toEqual(
      expect.arrayContaining([
        { name: 'trusted_projects' },
        { name: 'skills' },
        { name: 'skill_versions' },
        { name: 'version_files' },
        { name: 'test_cases' },
        { name: 'test_runs' },
      ]),
    );
    reopened.close();
  });

  it('stores trusted projects without exposing paths through generic lookup errors', () => {
    const database = new StudioDatabase(':memory:');
    database.saveTrustedProject({
      id: 'project-1',
      label: 'Project',
      path: '/canonical/project',
      trustedAt: '2026-09-22T12:00:00.000Z',
    });

    expect(database.listTrustedProjects()).toEqual([
      {
        id: 'project-1',
        label: 'Project',
        path: '/canonical/project',
        skillCount: 0,
        trustedAt: '2026-09-22T12:00:00.000Z',
      },
    ]);
    expect(database.getSkillRecord('missing')).toBeUndefined();
    database.close();
  });
});
