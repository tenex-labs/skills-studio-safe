import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { SkillCatalog } from '../catalog/catalog.ts';
import {
  getClaudeLoginState,
  getClaudeReadiness,
  startClaudeLogin,
  stopClaudeLogin,
} from '../platform/claude-readiness.ts';
import { pickProjectDirectory } from '../platform/folder-picker.ts';
import { StudioDatabase } from '../storage/database.ts';
import { SkillTestRunner } from '../testing/skill-runner.ts';
import { createStudioRoutes, type StudioApiRequest, type StudioPlatform } from './routes.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4319;
const VITE_DEV_PORT = 5173;
const MAX_BODY_BYTES = 6 * 1024 * 1024;

type StudioServerOptions = {
  database?: StudioDatabase;
  catalog?: SkillCatalog;
  runner?: SkillTestRunner;
  capability?: string;
  platform?: Partial<StudioPlatform>;
};

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Requests without an Origin header come from non-browser clients such as curl. Browser requests
// must come from the Vite dev server or from this server itself.
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.port === String(VITE_DEV_PORT) || url.port === String(DEFAULT_PORT))
    );
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(body === null ? undefined : JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new RequestError(413, 'Request body is too large.');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RequestError(400, 'Request body must be valid JSON.');
  }
}

function isMutation(method: string): boolean {
  return method === 'POST' || method === 'DELETE';
}

/**
 * Streams a run's traces as server-sent events. A connecting client first receives every trace
 * recorded so far, then live ones. The stream ends after the run's single result trace.
 */
function streamTraces(
  request: IncomingMessage,
  response: ServerResponse,
  runId: string,
  runner: SkillTestRunner,
): void {
  if (!runner.get(runId)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'X-Accel-Buffering': 'no',
  });
  response.write('retry: 1000\n\n');
  // The trace store keeps a sliding window, so track the last trace sent rather than a count.
  let lastSentId: string | undefined;
  let unsubscribe = () => {};
  unsubscribe = runner.subscribe(runId, ({ traces }) => {
    if (response.writableEnded) return;
    const start = lastSentId ? traces.findIndex(({ id }) => id === lastSentId) + 1 : 0;
    for (const trace of traces.slice(start)) {
      response.write(`id: ${trace.id}\ndata: ${JSON.stringify(trace)}\n\n`);
      lastSentId = trace.id;
      if (trace.kind === 'result') {
        // subscribe() delivers the current snapshot before it returns, so defer the unsubscribe.
        queueMicrotask(() => unsubscribe());
        response.end();
        return;
      }
    }
  });
  request.once('close', () => unsubscribe());
}

function defaultPlatform(catalog: SkillCatalog): StudioPlatform {
  return {
    claudeStatus: () => getClaudeReadiness(),
    loginState: getClaudeLoginState,
    startLogin: startClaudeLogin,
    pickProject: () => pickProjectDirectory(),
    personalRootExists: () =>
      access(catalog.personalRoot).then(
        () => true,
        () => false,
      ),
  };
}

export function createSkillStudioServer(options: StudioServerOptions = {}) {
  const database = options.database ?? new StudioDatabase();
  database.markInterruptedRuns();
  const catalog = options.catalog ?? new SkillCatalog({ database });
  const runner =
    options.runner ??
    new SkillTestRunner({
      persist: (run) => {
        database.saveTestRun(run);
      },
    });
  const capability = options.capability ?? randomBytes(24).toString('base64url');
  const routes = createStudioRoutes({
    catalog,
    database,
    runner,
    platform: { ...defaultPlatform(catalog), ...options.platform },
  });

  const server = createServer(async (request, response) => {
    try {
      if (!isAllowedOrigin(request.headers.origin)) {
        sendJson(response, 403, { error: 'Origin not allowed' });
        return;
      }
      const url = new URL(request.url ?? '/', 'http://localhost');
      const method = request.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { service: 'claude-skill-studio', status: 'ok' });
        return;
      }
      // The browser fetches this once and echoes it on every mutation. Together with the origin
      // check, it stops other local pages from changing Studio state.
      if (method === 'GET' && url.pathname === '/api/studio/session') {
        sendJson(response, 200, { capability });
        return;
      }
      const traceMatch = url.pathname.match(/^\/api\/studio\/test-runs\/([^/]+)\/events$/);
      if (method === 'GET' && traceMatch) {
        streamTraces(request, response, decodeURIComponent(traceMatch[1]!), runner);
        return;
      }

      if (isMutation(method)) {
        if (request.headers['content-type']?.split(';', 1)[0] !== 'application/json') {
          sendJson(response, 415, { error: 'JSON content type required' });
          return;
        }
        if (request.headers['x-studio-capability'] !== capability) {
          sendJson(response, 403, { error: 'Mutation capability rejected' });
          return;
        }
      }
      if (method !== 'GET' && !isMutation(method)) {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      const apiRequest: StudioApiRequest = {
        method: method as StudioApiRequest['method'],
        path: `${url.pathname}${url.search}`,
        ...(isMutation(method) ? { body: await readJson(request) } : {}),
      };
      const result = await routes(apiRequest);
      sendJson(response, result.status, result.body);
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      sendJson(response, 400, { error: 'Invalid Skill Studio request' });
    }
  });

  return {
    server,
    database,
    catalog,
    runner,
    async close(): Promise<void> {
      stopClaudeLogin();
      await runner.shutdown();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      database.close();
    },
  };
}

export function startSkillStudioServer(host = DEFAULT_HOST, port = DEFAULT_PORT) {
  const studio = createSkillStudioServer();
  studio.server.listen(port, host, () => {
    console.log(`Claude Skill Studio listening at http://${host}:${port}`);
  });
  return studio;
}
