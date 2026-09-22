import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSkillStudioServer } from '../../../app/backend/api/studio-server.ts';
import { SkillCatalog } from '../../../app/backend/catalog/catalog.ts';
import { StudioDatabase } from '../../../app/backend/versions/database.ts';

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

async function start(): Promise<string> {
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

describe('Skill Studio HTTP server', () => {
  it('serves the catalog and rejects mutations without the launch capability', async () => {
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

  it('exposes a same-origin capability without leaking settings', async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/api/studio/session`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ capability: 'known-capability' });
  });
});
