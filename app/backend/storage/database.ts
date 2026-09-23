import { chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';

import type {
  AssertionResult,
  SkillFile,
  SkillSummary,
  SkillTestCase,
  SkillTestRun,
  SkillVersion,
  StoredProject,
} from '../../domain/index.ts';

// Migrations are append-only. Never edit one that has shipped; add a new entry instead.
const migrations = [
  `
    CREATE TABLE trusted_projects (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      canonical_path TEXT NOT NULL UNIQUE,
      trusted_at TEXT NOT NULL
    );
    CREATE TABLE skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('personal', 'project')),
      project_id TEXT REFERENCES trusted_projects(id) ON DELETE CASCADE,
      relative_path TEXT NOT NULL,
      package_path TEXT NOT NULL,
      revision TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      read_only INTEGER NOT NULL,
      shadowed_by TEXT,
      validation_errors INTEGER NOT NULL,
      validation_warnings INTEGER NOT NULL,
      UNIQUE(scope, project_id, relative_path)
    );
    CREATE TABLE skill_versions (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      parent_version_id TEXT REFERENCES skill_versions(id),
      revision TEXT NOT NULL,
      label TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('filesystem', 'draft', 'promoted')),
      UNIQUE(skill_id, revision, source)
    );
    CREATE TABLE version_files (
      version_id TEXT NOT NULL REFERENCES skill_versions(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      mode INTEGER NOT NULL,
      PRIMARY KEY(version_id, path)
    );
    CREATE TABLE test_cases (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      expected_contains TEXT NOT NULL,
      expected_excludes TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE test_runs (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      version_id TEXT NOT NULL REFERENCES skill_versions(id),
      test_case_id TEXT REFERENCES test_cases(id) ON DELETE SET NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER,
      exit_code INTEGER,
      output TEXT,
      usage_json TEXT,
      assertions_json TEXT NOT NULL
    );
    CREATE INDEX skill_versions_by_skill ON skill_versions(skill_id, created_at DESC);
    CREATE INDEX test_cases_by_skill ON test_cases(skill_id, created_at);
    CREATE INDEX test_runs_by_skill ON test_runs(skill_id, started_at DESC);
  `,
  `
    ALTER TABLE test_runs ADD COLUMN effort TEXT;
    ALTER TABLE test_runs ADD COLUMN project_id TEXT;
    ALTER TABLE test_runs ADD COLUMN workspace_label TEXT;
    ALTER TABLE test_runs ADD COLUMN tool_preset TEXT;
  `,
] as const;

type TrustedProjectRow = {
  id: string;
  label: string;
  canonical_path: string;
  trusted_at: string;
};

type SkillRow = {
  id: string;
  name: string;
  description: string;
  scope: SkillSummary['scope'];
  project_id: string | null;
  relative_path: string;
  package_path: string;
  revision: string;
  file_count: number;
  read_only: number;
  shadowed_by: string | null;
  validation_errors: number;
  validation_warnings: number;
};

type VersionRow = {
  id: string;
  skill_id: string;
  parent_version_id: string | null;
  revision: string;
  label: string;
  note: string | null;
  created_at: string;
  source: SkillVersion['source'];
};

type FileRow = { path: string; content: string; mode: number };
type TestCaseRow = {
  id: string;
  skill_id: string;
  name: string;
  prompt: string;
  expected_contains: string;
  expected_excludes: string;
  created_at: string;
};
type TestRunRow = {
  id: string;
  skill_id: string;
  version_id: string;
  test_case_id: string | null;
  prompt: string;
  model: string;
  effort: string | null;
  project_id: string | null;
  workspace_label: string | null;
  tool_preset: SkillTestRun['toolPreset'] | null;
  status: SkillTestRun['status'];
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  output: string | null;
  usage_json: string | null;
  assertions_json: string;
};

// JSON columns are written only by this class, but a hand-edited or corrupted database must not
// crash the app, so each reader falls back to an empty value.
function parseJson(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function readStringArray(text: string): string[] {
  const value = parseJson(text);
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function readAssertions(text: string): AssertionResult[] {
  const value = parseJson(text);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AssertionResult =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as AssertionResult).label === 'string' &&
      typeof (entry as AssertionResult).passed === 'boolean',
  );
}

function readUsage(text: string | null): SkillTestRun['usage'] {
  const value = parseJson(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const number = (key: string): number | undefined => {
    const field = record[key];
    return typeof field === 'number' ? field : undefined;
  };
  return {
    inputTokens: number('inputTokens'),
    outputTokens: number('outputTokens'),
    costUsd: number('costUsd'),
  };
}

function testRunFrom(row: TestRunRow): SkillTestRun {
  const usage = readUsage(row.usage_json);
  return {
    id: row.id,
    skillId: row.skill_id,
    versionId: row.version_id,
    ...(row.test_case_id ? { testCaseId: row.test_case_id } : {}),
    prompt: row.prompt,
    model: row.model,
    ...(row.effort ? { effort: row.effort } : {}),
    ...(row.project_id ? { projectId: row.project_id } : {}),
    ...(row.workspace_label ? { workspaceLabel: row.workspace_label } : {}),
    ...(row.tool_preset ? { toolPreset: row.tool_preset } : {}),
    status: row.status,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
    ...(row.exit_code === null ? {} : { exitCode: row.exit_code }),
    ...(row.output === null ? {} : { output: row.output }),
    ...(usage ? { usage } : {}),
    assertions: readAssertions(row.assertions_json),
  };
}

export function defaultStudioDatabasePath(): string {
  if (process.platform === 'darwin') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'Claude Skill Studio',
      'studio.sqlite',
    );
  }
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? homedir(), 'Claude Skill Studio', 'studio.sqlite');
  }
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    'claude-skill-studio',
    'studio.sqlite',
  );
}

function filesFor(database: Database.Database, versionId: string): SkillFile[] {
  return database
    .prepare('SELECT path, content, mode FROM version_files WHERE version_id = ? ORDER BY path')
    .all(versionId) as FileRow[];
}

function versionFrom(database: Database.Database, row: VersionRow): SkillVersion {
  return {
    id: row.id,
    skillId: row.skill_id,
    ...(row.parent_version_id ? { parentVersionId: row.parent_version_id } : {}),
    revision: row.revision,
    label: row.label,
    ...(row.note ? { note: row.note } : {}),
    createdAt: row.created_at,
    source: row.source,
    files: filesFor(database, row.id),
  };
}

export class StudioDatabase {
  readonly connection: Database.Database;

  constructor(path = defaultStudioDatabasePath()) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.connection = new Database(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.connection.pragma('foreign_keys = ON');
    this.connection.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    const current = this.connection.pragma('user_version', { simple: true }) as number;
    if (current > migrations.length)
      throw new Error('Studio database schema is newer than this app.');
    for (let index = current; index < migrations.length; index += 1) {
      const migration = migrations[index];
      if (!migration) continue;
      this.connection.transaction(() => {
        this.connection.exec(migration);
        this.connection.pragma(`user_version = ${index + 1}`);
      })();
    }
  }

  close(): void {
    this.connection.close();
  }

  saveTrustedProject(project: StoredProject): void {
    this.connection
      .prepare(
        `INSERT INTO trusted_projects(id, label, canonical_path, trusted_at)
         VALUES (@id, @label, @path, @trustedAt)
         ON CONFLICT(canonical_path) DO UPDATE SET label = excluded.label`,
      )
      .run(project);
  }

  listTrustedProjects(): StoredProject[] {
    const rows = this.connection
      .prepare(
        'SELECT id, label, canonical_path, trusted_at FROM trusted_projects ORDER BY trusted_at, id',
      )
      .all() as TrustedProjectRow[];
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      path: row.canonical_path,
      trustedAt: row.trusted_at,
    }));
  }

  getTrustedProject(id: string): StoredProject | undefined {
    return this.listTrustedProjects().find((project) => project.id === id);
  }

  removeTrustedProject(id: string): boolean {
    return this.connection.prepare('DELETE FROM trusted_projects WHERE id = ?').run(id).changes > 0;
  }

  saveSkill(summary: SkillSummary, packagePath: string): void {
    this.connection
      .prepare(
        `INSERT INTO skills(
          id, name, description, scope, project_id, relative_path, package_path, revision,
          file_count, read_only, shadowed_by, validation_errors, validation_warnings
        ) VALUES (
          @id, @name, @description, @scope, @projectId, @relativePath, @packagePath, @revision,
          @fileCount, @readOnly, @shadowedBy, @errors, @warnings
        ) ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, description = excluded.description, revision = excluded.revision,
          file_count = excluded.file_count, read_only = excluded.read_only,
          shadowed_by = excluded.shadowed_by, validation_errors = excluded.validation_errors,
          validation_warnings = excluded.validation_warnings, package_path = excluded.package_path`,
      )
      .run({
        ...summary,
        projectId: summary.projectId ?? null,
        packagePath,
        readOnly: Number(summary.readOnly),
        shadowedBy: summary.shadowedBy ?? null,
        errors: summary.validation.errors,
        warnings: summary.validation.warnings,
      });
  }

  getSkillRecord(id: string): { summary: SkillSummary; packagePath: string } | undefined {
    const row = this.connection.prepare('SELECT * FROM skills WHERE id = ?').get(id) as
      SkillRow | undefined;
    if (!row) return undefined;
    return {
      summary: {
        id: row.id,
        name: row.name,
        description: row.description,
        scope: row.scope,
        ...(row.project_id ? { projectId: row.project_id } : {}),
        relativePath: row.relative_path,
        revision: row.revision,
        fileCount: row.file_count,
        readOnly: Boolean(row.read_only),
        ...(row.shadowed_by ? { shadowedBy: row.shadowed_by } : {}),
        validation: { errors: row.validation_errors, warnings: row.validation_warnings },
      },
      packagePath: row.package_path,
    };
  }

  listSkills(): SkillSummary[] {
    const ids = this.connection.prepare('SELECT id FROM skills ORDER BY name, scope').all() as {
      id: string;
    }[];
    return ids.flatMap(({ id }) => {
      const record = this.getSkillRecord(id);
      return record ? [record.summary] : [];
    });
  }

  saveVersion(version: SkillVersion): SkillVersion {
    const existing = this.connection
      .prepare('SELECT * FROM skill_versions WHERE skill_id = ? AND revision = ? AND source = ?')
      .get(version.skillId, version.revision, version.source) as VersionRow | undefined;
    if (existing) return versionFrom(this.connection, existing);
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `INSERT INTO skill_versions(
            id, skill_id, parent_version_id, revision, label, note, created_at, source
          ) VALUES (@id, @skillId, @parentVersionId, @revision, @label, @note, @createdAt, @source)`,
        )
        .run({
          ...version,
          parentVersionId: version.parentVersionId ?? null,
          note: version.note ?? null,
        });
      const insert = this.connection.prepare(
        'INSERT INTO version_files(version_id, path, content, mode) VALUES (?, ?, ?, ?)',
      );
      for (const file of version.files) insert.run(version.id, file.path, file.content, file.mode);
    })();
    return version;
  }

  getVersion(id: string): SkillVersion | undefined {
    const row = this.connection.prepare('SELECT * FROM skill_versions WHERE id = ?').get(id) as
      VersionRow | undefined;
    return row ? versionFrom(this.connection, row) : undefined;
  }

  listVersions(skillId: string): SkillVersion[] {
    const rows = this.connection
      .prepare('SELECT * FROM skill_versions WHERE skill_id = ? ORDER BY created_at DESC, id DESC')
      .all(skillId) as VersionRow[];
    return rows.map((row) => versionFrom(this.connection, row));
  }

  saveTestCase(testCase: SkillTestCase): SkillTestCase {
    this.connection
      .prepare(
        `INSERT INTO test_cases(
          id, skill_id, name, prompt, expected_contains, expected_excludes, created_at
        ) VALUES (@id, @skillId, @name, @prompt, @expectedContains, @expectedExcludes, @createdAt)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, prompt = excluded.prompt,
          expected_contains = excluded.expected_contains, expected_excludes = excluded.expected_excludes`,
      )
      .run({
        ...testCase,
        expectedContains: JSON.stringify(testCase.expectedContains),
        expectedExcludes: JSON.stringify(testCase.expectedExcludes),
      });
    return testCase;
  }

  listTestCases(skillId: string): SkillTestCase[] {
    const rows = this.connection
      .prepare('SELECT * FROM test_cases WHERE skill_id = ? ORDER BY created_at, id')
      .all(skillId) as TestCaseRow[];
    return rows.map((row) => ({
      id: row.id,
      skillId: row.skill_id,
      name: row.name,
      prompt: row.prompt,
      expectedContains: readStringArray(row.expected_contains),
      expectedExcludes: readStringArray(row.expected_excludes),
      createdAt: row.created_at,
    }));
  }

  deleteTestCase(id: string): boolean {
    return this.connection.prepare('DELETE FROM test_cases WHERE id = ?').run(id).changes > 0;
  }

  saveTestRun(run: SkillTestRun): SkillTestRun {
    this.connection
      .prepare(
        `INSERT INTO test_runs(
          id, skill_id, version_id, test_case_id, prompt, model, effort, project_id,
          workspace_label, tool_preset, status, started_at, finished_at, duration_ms, exit_code,
          output, usage_json, assertions_json
        ) VALUES (
          @id, @skillId, @versionId, @testCaseId, @prompt, @model, @effort, @projectId,
          @workspaceLabel, @toolPreset, @status, @startedAt, @finishedAt, @durationMs, @exitCode,
          @output, @usage, @assertions
        ) ON CONFLICT(id) DO UPDATE SET status = excluded.status, started_at = excluded.started_at,
          finished_at = excluded.finished_at, duration_ms = excluded.duration_ms,
          exit_code = excluded.exit_code, output = excluded.output, usage_json = excluded.usage_json,
          assertions_json = excluded.assertions_json`,
      )
      .run({
        ...run,
        testCaseId: run.testCaseId ?? null,
        effort: run.effort ?? null,
        projectId: run.projectId ?? null,
        workspaceLabel: run.workspaceLabel ?? null,
        toolPreset: run.toolPreset ?? null,
        startedAt: run.startedAt ?? null,
        finishedAt: run.finishedAt ?? null,
        durationMs: run.durationMs ?? null,
        exitCode: run.exitCode ?? null,
        output: run.output ?? null,
        usage: run.usage ? JSON.stringify(run.usage) : null,
        assertions: JSON.stringify(run.assertions),
      });
    return run;
  }

  listTestRuns(skillId?: string): SkillTestRun[] {
    const rows = (
      skillId
        ? this.connection
            .prepare('SELECT * FROM test_runs WHERE skill_id = ? ORDER BY started_at DESC, id DESC')
            .all(skillId)
        : this.connection.prepare('SELECT * FROM test_runs ORDER BY started_at DESC, id DESC').all()
    ) as TestRunRow[];
    return rows.map(testRunFrom);
  }

  getTestRun(id: string): SkillTestRun | undefined {
    const row = this.connection.prepare('SELECT * FROM test_runs WHERE id = ?').get(id) as
      TestRunRow | undefined;
    return row ? testRunFrom(row) : undefined;
  }

  /**
   * Runs live only in server memory, so any row still queued or running at startup belongs to a
   * process that no longer exists. Mark it interrupted rather than inventing a result.
   */
  markInterruptedRuns(): number {
    return this.connection
      .prepare("UPDATE test_runs SET status = 'interrupted' WHERE status IN ('queued', 'running')")
      .run().changes;
  }
}
