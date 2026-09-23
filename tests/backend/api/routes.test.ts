import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStudioRoutes, type StudioRoutesOptions } from '../../../app/backend/api/routes.ts';
import { SkillCatalog } from '../../../app/backend/catalog/catalog.ts';
import { StudioValidationError } from '../../../app/backend/errors.ts';
import { StudioDatabase } from '../../../app/backend/storage/database.ts';
import type { SkillTestRun } from '../../../app/domain/index.ts';

const NOW = '2026-09-22T12:00:00.000Z';
const databases: StudioDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function fakeRunner(): StudioRoutesOptions['runner'] {
  const runs = new Map<string, SkillTestRun>();
  return {
    activeRunCount: 0,
    launch: vi.fn((input) => {
      const run: SkillTestRun = {
        id: 'run-1',
        skillId: 'skillId' in input.skill ? input.skill.skillId : input.skill.id,
        versionId: input.skill.id,
        testCaseId: input.testCase?.id,
        prompt: input.prompt,
        model: input.model,
        status: 'queued',
        assertions: [],
      };
      runs.set(run.id, run);
      return run;
    }),
    get: (id) => {
      const run = runs.get(id);
      return run && { run, traces: [] };
    },
    cancel: (id) => runs.has(id),
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'studio-routes-'));
  const personalRoot = join(root, 'personal');
  await mkdir(join(personalRoot, 'example'), { recursive: true });
  await writeFile(
    join(personalRoot, 'example', 'SKILL.md'),
    '---\nname: example\ndescription: Example\n---\n',
  );
  const database = new StudioDatabase(':memory:');
  databases.push(database);
  let generatedId = 0;
  const catalog = new SkillCatalog({
    database,
    personalRoot,
    now: () => NOW,
    id: () => `generated-id-${generatedId++}`,
  });
  const runner = fakeRunner();
  const api = createStudioRoutes({
    catalog,
    database,
    runner,
    platform: {
      claudeStatus: async () => ({ available: true, authenticated: true, version: '2.1.0' }),
      loginState: () => ({ state: 'idle' }),
      startLogin: () => ({ started: true }),
      pickProject: async () => {
        throw new StudioValidationError('Folder selection was cancelled.');
      },
      personalRootExists: async () => true,
    },
    now: () => NOW,
    id: () => 'test-case-id',
  });
  const catalogResponse = await api({ method: 'GET', path: '/api/studio/catalog' });
  const skillId = (catalogResponse.body as { skills: { id: string }[] }).skills[0]!.id;
  return { api, database, runner, skillId };
}

describe('createStudioRoutes', () => {
  it('reports readiness from the platform and runner', async () => {
    const { api } = await setup();
    expect(await api({ method: 'GET', path: '/api/studio/readiness' })).toEqual({
      status: 200,
      body: {
        claude: { available: true, authenticated: true, version: '2.1.0' },
        authLogin: { state: 'idle' },
        database: 'ready',
        personalSkillsRoot: 'ready',
        activeTests: 0,
      },
    });
  });

  it('serves skills, versions, and test cases', async () => {
    const { api, skillId } = await setup();
    expect(await api({ method: 'GET', path: `/api/studio/skills/${skillId}` })).toMatchObject({
      status: 200,
    });
    expect(
      await api({ method: 'GET', path: `/api/studio/skills/${skillId}/versions` }),
    ).toMatchObject({ status: 200, body: { versions: [expect.anything()] } });

    const created = await api({
      method: 'POST',
      path: `/api/studio/skills/${skillId}/test-cases`,
      body: { name: 'Smoke', prompt: 'Use the skill', expectedContains: ['done'] },
    });
    expect(created.status).toBe(201);
    expect(await api({ method: 'GET', path: `/api/studio/skills/${skillId}/test-cases` })).toEqual({
      status: 200,
      body: {
        testCases: [expect.objectContaining({ id: 'test-case-id', name: 'Smoke', skillId })],
      },
    });
    expect(await api({ method: 'DELETE', path: '/api/studio/test-cases/test-case-id' })).toEqual({
      status: 204,
      body: null,
    });
  });

  it('launches a run against a stored version and records it immediately', async () => {
    const { api, database, runner, skillId } = await setup();
    const [version] = database.listVersions(skillId);

    const launched = await api({
      method: 'POST',
      path: '/api/studio/test-runs',
      body: {
        skillId,
        versionId: version!.id,
        prompt: 'Prompt',
        model: 'sonnet',
        settings: { maxTurns: 4, timeoutSeconds: 60, effort: 'high', toolPreset: 'none' },
      },
    });

    expect(launched).toMatchObject({ status: 202, body: { testRun: { id: 'run-1' } } });
    expect(runner.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: { maxTurns: 4, timeoutSeconds: 60, effort: 'high', toolPreset: 'none' },
      }),
    );
    expect(database.getTestRun('run-1')).toMatchObject({ status: 'queued' });
    expect(await api({ method: 'GET', path: '/api/studio/test-runs/run-1' })).toMatchObject({
      status: 200,
    });
    expect(
      await api({ method: 'GET', path: `/api/studio/test-runs?skillId=${skillId}` }),
    ).toMatchObject({ body: { testRuns: [expect.objectContaining({ id: 'run-1' })] } });
  });

  it('maps domain errors to 400, 404, and 409 without leaking internals', async () => {
    const { api, database, skillId } = await setup();
    const [version] = database.listVersions(skillId);
    expect(
      await api({
        method: 'POST',
        path: '/api/studio/test-runs',
        body: { skillId, versionId: 'missing', prompt: 'Prompt', model: 'sonnet' },
      }),
    ).toEqual({ status: 404, body: { error: 'Version not found.' } });
    expect(
      await api({
        method: 'POST',
        path: '/api/studio/test-runs',
        body: {
          skillId,
          versionId: version!.id,
          prompt: 'Prompt',
          model: 'sonnet',
          settings: { effort: 'huge' },
        },
      }),
    ).toEqual({ status: 400, body: { error: 'settings.effort is not a supported effort level.' } });
    expect(await api({ method: 'POST', path: '/api/studio/projects/pick', body: {} })).toEqual({
      status: 400,
      body: { error: 'Folder selection was cancelled.' },
    });
    expect(
      await api({
        method: 'POST',
        path: `/api/studio/skills/${skillId}/drafts`,
        body: {
          baseRevision: 'stale',
          label: 'Draft',
          files: [{ path: 'SKILL.md', content: '---\nname: example\n---\n', mode: 420 }],
        },
      }),
    ).toMatchObject({ status: 409, body: { error: 'Revision conflict' } });
    expect(await api({ method: 'GET', path: '/api/studio/nothing-here' })).toEqual({
      status: 404,
      body: { error: 'Not found' },
    });
  });

  it('validates a working copy without saving it', async () => {
    const { api, skillId } = await setup();
    const response = await api({
      method: 'POST',
      path: '/api/studio/validate',
      body: {
        skillId,
        files: [{ path: 'SKILL.md', content: '---\nname: Bad Name\n---\n', mode: 420 }],
      },
    });
    expect(response).toMatchObject({
      status: 200,
      body: { validation: { valid: false, findings: expect.any(Array) } },
    });
  });
});
