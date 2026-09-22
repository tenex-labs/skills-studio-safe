import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { InvalidHookPayloadError, normalizeHookPayload } from './sanitize.ts';
import { createSetupStatusProvider, type SetupStatusDependencies } from './setup.ts';
import { MissionEventStore } from './store.ts';
import type { MissionEvent } from './types.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4319;
const MAX_BODY_BYTES = 64 * 1024;
const SSE_HEARTBEAT_MS = 15_000;

class InvalidRequestBodyError extends Error {}
class RequestBodyTooLargeError extends Error {}

export type CollectorOptions = {
  store?: MissionEventStore;
  setup?: SetupStatusDependencies;
};

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1')
    );
  } catch {
    return false;
  }
}

function applyCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  if (!isLocalDevelopmentOrigin(origin)) {
    return false;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Vary', 'Origin');
  return true;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        if (!settled) {
          settled = true;
          reject(new RequestBodyTooLargeError());
        }
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new InvalidRequestBodyError());
      }
    });
    request.on('error', () => {
      if (!settled) {
        settled = true;
        reject(new InvalidRequestBodyError());
      }
    });
  });
}

export function formatSse(event: MissionEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

function openEventStream(
  request: IncomingMessage,
  response: ServerResponse,
  store: MissionEventStore,
): void {
  response.writeHead(200, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'X-Accel-Buffering': 'no',
  });
  response.write('retry: 1000\n\n');

  for (const event of store.list()) {
    response.write(formatSse(event));
  }

  const unsubscribe = store.subscribe((event) => {
    response.write(formatSse(event));
  });
  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n');
  }, SSE_HEARTBEAT_MS);
  heartbeat.unref();

  request.once('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

export function createCollectorServer(options: CollectorOptions = {}) {
  const store = options.store ?? new MissionEventStore();
  const getSetupStatus = createSetupStatusProvider(store, options.setup);
  const startedAt = Date.now();

  const server = createServer(async (request, response) => {
    if (!applyCors(request, response)) {
      sendJson(response, 403, { error: 'Origin not allowed' });
      return;
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (request.method === 'POST' && pathname === '/hooks') {
      try {
        const payload = await readJsonBody(request);
        const event = normalizeHookPayload(payload);
        store.add(event);
        sendJson(response, 202, { accepted: true });
      } catch (error) {
        if (error instanceof InvalidRequestBodyError || error instanceof InvalidHookPayloadError) {
          sendJson(response, 400, { error: 'Invalid hook payload' });
          return;
        }
        if (error instanceof RequestBodyTooLargeError) {
          sendJson(response, 413, { error: 'Hook payload too large' });
          return;
        }
        sendJson(response, 500, { error: 'Collector error' });
      }
      return;
    }

    if (request.method === 'GET' && pathname === '/events') {
      openEventStream(request, response, store);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/events') {
      sendJson(response, 200, store.list());
      return;
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      sendJson(response, 200, {
        service: 'agent-mission-control-collector',
        status: 'ok',
        eventCount: store.size,
        subscriberCount: store.subscriberCount,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/setup') {
      sendJson(response, 200, await getSetupStatus());
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });

  return { server, store };
}

export function startCollector(
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
): ReturnType<typeof createCollectorServer> {
  const collector = createCollectorServer();
  collector.server.listen(port, host, () => {
    console.log(`Agent Mission Control collector listening at http://${host}:${port}`);
  });
  return collector;
}
