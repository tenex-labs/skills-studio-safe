import type { Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { createCollectorServer, type CollectorOptions } from '../../server/collector.ts';

const openServers: Server[] = [];

async function startServer(options: CollectorOptions = {}): Promise<string> {
  const { server } = createCollectorServer(options);
  openServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Collector did not bind to a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('collector HTTP API', () => {
  it('acknowledges a valid hook and exposes only normalized data', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook_event_name: 'PostToolUse',
        session_id: 'private-session',
        tool_name: 'Bash',
        cwd: '/private/customer/repository',
        prompt: 'do not retain this prompt',
        tool_input: { command: 'echo secret-value' },
      }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true });

    const eventsResponse = await fetch(`${baseUrl}/api/events`);
    const responseText = await eventsResponse.text();
    expect(eventsResponse.status).toBe(200);
    expect(JSON.parse(responseText)).toMatchObject([
      {
        kind: 'tool',
        action: 'use',
        status: 'succeeded',
        toolCategory: 'shell',
        repository: 'repository',
      },
    ]);
    expect(responseText).not.toContain('private-session');
    expect(responseText).not.toContain('do not retain');
    expect(responseText).not.toContain('secret-value');
    expect(responseText).not.toContain('/private');
  });

  it('returns 400 without storing invalid payloads', async () => {
    const baseUrl = await startServer();
    const invalidResponse = await fetch(`${baseUrl}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'SessionStart' }),
    });

    expect(invalidResponse.status).toBe(400);
    await expect(fetch(`${baseUrl}/api/events`).then((result) => result.json())).resolves.toEqual(
      [],
    );
  });

  it('allows local development origins and rejects remote origins', async () => {
    const baseUrl = await startServer();
    const localResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    const remoteResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://example.com' },
    });

    expect(localResponse.status).toBe(200);
    expect(localResponse.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(remoteResponse.status).toBe(403);
  });

  it('reports safe setup readiness before and after the first accepted event', async () => {
    const baseUrl = await startServer({
      setup: {
        getHookStatus: async () => 'installed',
        getClaudeCliStatus: async () => ({ available: true, version: '2.1.0' }),
      },
    });

    await expect(fetch(`${baseUrl}/api/setup`).then((result) => result.json())).resolves.toEqual({
      collectorReady: true,
      hooks: { status: 'installed' },
      events: { acceptedCount: 0, firstEventReceived: false },
      claude: { available: true, version: '2.1.0' },
    });

    await fetch(`${baseUrl}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook_event_name: 'SessionStart',
        session_id: 'private-session',
      }),
    });

    const responseText = await fetch(`${baseUrl}/api/setup`).then((result) => result.text());
    expect(JSON.parse(responseText)).toMatchObject({
      events: { acceptedCount: 1, firstEventReceived: true },
    });
    expect(responseText).not.toContain('settings');
    expect(responseText).not.toContain('/Users/');
    expect(responseText).not.toContain('private-session');
  });
});
