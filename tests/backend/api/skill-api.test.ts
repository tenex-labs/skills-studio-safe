import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createStudioApi } from '../../../app/backend/api/studio-api.ts';
import { SkillCatalog } from '../../../app/backend/catalog/catalog.ts';
import { StudioDatabase } from '../../../app/backend/versions/database.ts';

const databases: StudioDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'studio-api-'));
  const personalRoot = join(root, 'personal');
  await mkdir(join(personalRoot, 'example'), { recursive: true });
  await writeFile(
    join(personalRoot, 'example', 'SKILL.md'),
    '---\nname: example\ndescription: Example\n---\n',
  );
  const database = new StudioDatabase(':memory:');
  databases.push(database);
  const catalog = new SkillCatalog({
    database,
    personalRoot,
    now: () => '2026-09-22T12:00:00.000Z',
    id: () => 'generated-id',
  });
  const api = createStudioApi({
    catalog,
    now: () => '2026-09-22T12:00:00.000Z',
    id: () => 'test-case-id',
  });
  return { api, catalog };
}

describe('createStudioApi', () => {
  it('exposes readiness, catalog, detail, validation, versions, and test-case storage', async () => {
    const { api } = await setup();
    expect(await api({ method: 'GET', path: '/api/studio/readiness' })).toEqual(
      expect.objectContaining({ status: 200 }),
    );
    const catalogResponse = await api({ method: 'GET', path: '/api/studio/catalog' });
    const skillId = (catalogResponse.body as { skills: { id: string }[] }).skills[0]!.id;

    expect(await api({ method: 'GET', path: `/api/studio/skills/${skillId}` })).toEqual(
      expect.objectContaining({ status: 200 }),
    );
    expect(await api({ method: 'GET', path: `/api/studio/skills/${skillId}/versions` })).toEqual(
      expect.objectContaining({ status: 200 }),
    );
    const testCase = await api({
      method: 'POST',
      path: `/api/studio/skills/${skillId}/test-cases`,
      capability: 'test-capability',
      body: {
        name: 'Smoke',
        prompt: 'Use the skill',
        expectedContains: ['done'],
        expectedExcludes: ['error'],
      },
    });
    expect(testCase.status).toBe(201);
    expect(await api({ method: 'GET', path: `/api/studio/skills/${skillId}/test-cases` })).toEqual({
      status: 200,
      body: {
        testCases: [expect.objectContaining({ id: 'test-case-id', name: 'Smoke', skillId })],
      },
    });
  });

  it('requires mutation capability and returns sanitized failures', async () => {
    const { api } = await setup();
    const response = await api({
      method: 'POST',
      path: '/api/studio/projects',
      body: { path: '/secret/missing', trust: true },
    });
    expect(response).toEqual({
      status: 400,
      body: { error: 'Mutation capability is required.' },
    });

    expect(
      await api({
        method: 'POST',
        path: '/api/studio/test-runs',
        capability: 'test-capability',
        body: {
          skillId: 'skill',
          versionId: 'version',
          prompt: 'prompt',
          model: 'model',
        },
      }),
    ).toEqual({ status: 501, body: { error: 'Test runner unavailable' } });
  });
});
