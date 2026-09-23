import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSkillStudioServer } from '../../../app/backend/api/server.ts';
import type { StudioPlatform } from '../../../app/backend/api/routes.ts';
import { SkillCatalog } from '../../../app/backend/catalog/catalog.ts';
import { StudioDatabase } from '../../../app/backend/storage/database.ts';

const servers: Server[] = [];
const databases: StudioDatabase[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
  for (const database of databases.splice(0)) database.close();
});

async function start(platform: Partial<StudioPlatform> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skill-studio-server-'));
  const personalRoot = join(root, 'skills');
  await mkdir(join(personalRoot, 'example'), { recursive: true });
  await writeFile(
    join(personalRoot, 'example', 'SKILL.md'),
    '---\nname: example\ndescription: Example skill\n---\n',
  );
  const database = new StudioDatabase(':memory:');
  databases.push(database);
  const studio = createSkillStudioServer({
    database,
    catalog: new SkillCatalog({ database, personalRoot }),
    capability: 'known-capability',
    platform,
  });
  servers.push(studio.server);
  await new Promise<void>((resolve, reject) => {
    studio.server.once('error', reject);
    studio.server.listen(0, '127.0.0.1', resolve);
  });
  const address = studio.server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind');
  return `http://127.0.0.1:${address.port}`;
}

const mutationHeaders = {
  'Content-Type': 'application/json',
  'X-Studio-Capability': 'known-capability',
};

describe('Skill Studio HTTP server', () => {
  it('serves the catalog and rejects mutations without the session capability', async () => {
    const baseUrl = await start();
    const catalog = await fetch(`${baseUrl}/api/studio/catalog`).then((response) =>
      response.json(),
    );
    expect(catalog).toMatchObject({ skills: [expect.objectContaining({ name: 'example' })] });

    const rejected = await fetch(`${baseUrl}/api/studio/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/tmp', label: 'Unsafe', trust: true }),
    });
    expect(rejected.status).toBe(403);
  });

  it('exposes the session capability to same-origin clients', async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/api/studio/session`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ capability: 'known-capability' });
  });

  it('rejects foreign browser origins, non-JSON mutations, and oversized bodies', async () => {
    const baseUrl = await start();
    const foreign = await fetch(`${baseUrl}/api/studio/catalog`, {
      headers: { Origin: 'https://example.com' },
    });
    expect(foreign.status).toBe(403);

    const notJson = await fetch(`${baseUrl}/api/studio/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-Studio-Capability': 'known-capability' },
      body: '{}',
    });
    expect(notJson.status).toBe(415);

    const oversized = await fetch(`${baseUrl}/api/studio/projects`, {
      method: 'POST',
      headers: mutationHeaders,
      body: JSON.stringify({ path: 'x'.repeat(7 * 1024 * 1024) }),
    });
    expect(oversized.status).toBe(413);

    const malformed = await fetch(`${baseUrl}/api/studio/projects`, {
      method: 'POST',
      headers: mutationHeaders,
      body: '{not json',
    });
    expect(malformed.status).toBe(400);
  });

  it('routes folder selection and Claude login through the platform', async () => {
    const baseUrl = await start({
      pickProject: async () => ({ label: 'sample', path: '/Users/test/sample' }),
      startLogin: () => ({ started: true }),
    });

    await expect(
      fetch(`${baseUrl}/api/studio/projects/pick`, {
        method: 'POST',
        headers: mutationHeaders,
        body: '{}',
      }).then((response) => response.json()),
    ).resolves.toEqual({ project: { label: 'sample', path: '/Users/test/sample' } });
    await expect(
      fetch(`${baseUrl}/api/studio/auth/login`, {
        method: 'POST',
        headers: mutationHeaders,
        body: '{}',
      }).then((response) => response.json()),
    ).resolves.toEqual({ started: true });
  });

  it('returns 404 for the event stream of an unknown run', async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/api/studio/test-runs/missing/events`);
    expect(response.status).toBe(404);
  });
});
