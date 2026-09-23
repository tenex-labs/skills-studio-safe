import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { StudioDatabase } from '../../../app/backend/storage/database.ts';
import type { SkillTestRun } from '../../../app/domain/index.ts';

const NOW = '2026-09-22T12:00:00.000Z';

function withSkillAndVersion(): StudioDatabase {
  const database = new StudioDatabase(':memory:');
  database.saveSkill(
    {
      id: 'skill-1',
      name: 'example',
      description: 'Example',
      scope: 'personal',
      relativePath: 'example',
      revision: 'sha256:1',
      fileCount: 1,
      readOnly: false,
      validation: { errors: 0, warnings: 0 },
    },
    '/skills/example',
  );
  database.saveVersion({
    id: 'version-1',
    skillId: 'skill-1',
    revision: 'sha256:1',
    label: 'Filesystem baseline',
    createdAt: NOW,
    source: 'filesystem',
    files: [{ path: 'SKILL.md', content: '---\nname: example\n---\n', mode: 0o644 }],
  });
  return database;
}

function run(overrides: Partial<SkillTestRun> = {}): SkillTestRun {
  return {
    id: 'run-1',
    skillId: 'skill-1',
    versionId: 'version-1',
    prompt: 'Prompt',
    model: 'sonnet',
    status: 'running',
    startedAt: NOW,
    assertions: [],
    ...overrides,
  };
}

describe('StudioDatabase', () => {
  it('applies explicit migrations and reopens the same schema in WAL mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-database-'));
    const path = join(root, 'studio.sqlite');
    const first = new StudioDatabase(path);

    expect(first.connection.pragma('user_version', { simple: true })).toBe(2);
    expect(first.connection.pragma('journal_mode', { simple: true })).toBe('wal');
    first.close();

    const reopened = new StudioDatabase(path);
    expect(reopened.connection.pragma('user_version', { simple: true })).toBe(2);
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
        trustedAt: '2026-09-22T12:00:00.000Z',
      },
    ]);
    expect(database.getSkillRecord('missing')).toBeUndefined();
    database.close();
  });

  it('round-trips test cases and upserts a run from launch to completion', () => {
    const database = withSkillAndVersion();
    database.saveTestCase({
      id: 'case-1',
      skillId: 'skill-1',
      name: 'Smoke',
      prompt: 'Prompt',
      expectedContains: ['done'],
      expectedExcludes: [],
      createdAt: NOW,
    });
    database.saveTestRun(run({ testCaseId: 'case-1' }));
    database.saveTestRun(
      run({
        testCaseId: 'case-1',
        status: 'passed',
        output: 'done',
        usage: { inputTokens: 3, outputTokens: 2 },
        assertions: [{ label: 'Output contains "done"', passed: true }],
      }),
    );

    expect(database.listTestCases('skill-1')).toEqual([
      expect.objectContaining({ id: 'case-1', expectedContains: ['done'], expectedExcludes: [] }),
    ]);
    expect(database.listTestRuns()).toHaveLength(1);
    expect(database.getTestRun('run-1')).toMatchObject({
      status: 'passed',
      output: 'done',
      usage: { inputTokens: 3, outputTokens: 2 },
      assertions: [{ label: 'Output contains "done"', passed: true }],
    });
    database.close();
  });

  it('marks runs left running by a previous server as interrupted', () => {
    const database = withSkillAndVersion();
    database.saveTestRun(run({ id: 'running', status: 'running' }));
    database.saveTestRun(run({ id: 'queued', status: 'queued' }));
    database.saveTestRun(run({ id: 'finished', status: 'passed' }));

    expect(database.markInterruptedRuns()).toBe(2);
    expect(database.getTestRun('running')?.status).toBe('interrupted');
    expect(database.getTestRun('queued')?.status).toBe('interrupted');
    expect(database.getTestRun('finished')?.status).toBe('passed');
    database.close();
  });

  it('tolerates corrupted JSON columns instead of crashing', () => {
    const database = withSkillAndVersion();
    database.saveTestRun(run());
    database.connection
      .prepare("UPDATE test_runs SET assertions_json = 'not json', usage_json = '[1]'")
      .run();

    expect(database.getTestRun('run-1')).toMatchObject({ assertions: [] });
    database.close();
  });

  it('refuses to open a database written by a newer version of the app', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-database-newer-'));
    const path = join(root, 'studio.sqlite');
    const database = new StudioDatabase(path);
    database.connection.pragma('user_version = 99');
    database.close();

    expect(() => new StudioDatabase(path)).toThrow('newer than this app');
  });
});
