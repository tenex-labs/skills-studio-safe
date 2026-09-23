import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { SkillCatalog } from '../catalog/catalog.ts';
import {
  getClaudeReadiness,
  getClaudeLoginState,
  startClaudeLogin,
  stopClaudeLogin,
} from '../platform/claude-readiness.ts';
import { pickProjectDirectory } from '../platform/folder-picker.ts';
import { SkillTestRunner } from '../testing/skill-runner.ts';
import { StudioDatabase } from '../versions/database.ts';
import { createStudioApi, type StudioApiRequest } from './studio-api.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4319;
const MAX_BODY_BYTES = 6 * 1024 * 1024;

type StudioServerOptions = {
  database?: StudioDatabase;
  catalog?: SkillCatalog;
  runner?: SkillTestRunner;
  capability?: string;
  pickProject?: typeof pickProjectDirectory;
  startLogin?: typeof startClaudeLogin;
};

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.port === '5173' || url.port === '4319')
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
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function isMutation(method: string | undefined): boolean {
  return method === 'POST' || method === 'DELETE';
}

function traceStream(
  request: IncomingMessage,
  response: ServerResponse,
  runId: string,
  runner: SkillTestRunner,
): void {
  const snapshot = runner.get(runId);
  if (!snapshot) {
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
  let sent = 0;

  const unsubscribe = runner.subscribe(runId, (next) => {
    const traces = next.traces.slice(sent);
    sent = next.traces.length;
    for (const trace of traces) {
      response.write(`id: ${trace.id}\ndata: ${JSON.stringify(trace)}\n\n`);
    }
  });

  request.once('close', unsubscribe);
}

export function createSkillStudioServer(options: StudioServerOptions = {}) {
  const database = options.database ?? new StudioDatabase();
  const catalog = options.catalog ?? new SkillCatalog({ database });
  const runner =
    options.runner ??
    new SkillTestRunner({
      persist: (run) => {
        database.saveTestRun(run);
      },
    });
  const capability = options.capability ?? randomBytes(24).toString('base64url');
  const pickProject = options.pickProject ?? pickProjectDirectory;
  const startLogin = options.startLogin ?? startClaudeLogin;
  const api = createStudioApi({
    catalog,
    database,
    readiness: async () => {
      const claude = await getClaudeReadiness();
      let personalSkillsRoot: 'ready' | 'missing' = 'missing';
      try {
        await access(catalog.personalRoot);
        personalSkillsRoot = 'ready';
      } catch {
        // A missing personal root is a valid empty state.
      }
      return {
        claude,
        authLogin: getClaudeLoginState(),
        database: 'ready',
        personalSkillsRoot,
        activeTests: database.listTestRuns().filter(({ status }) => status === 'running').length,
      };
    },
    launchTest: async ({ skillId, versionId, testCaseId, prompt, model, projectId, settings }) => {
      const version = database.getVersion(versionId);
      if (!version || version.skillId !== skillId) throw new Error('Version not found.');
      const testCase = testCaseId
        ? database.listTestCases(skillId).find(({ id }) => id === testCaseId)
        : undefined;
      const project = projectId ? database.getTrustedProject(projectId) : undefined;
      if (projectId && !project) throw new Error('Workspace not found.');
      return runner.launch({
        skill: version,
        prompt,
        model,
        testCase,
        settings,
        workspace: project
          ? { id: project.id, label: project.label, path: project.path }
          : undefined,
      });
    },
    cancelTest: async (runId) => {
      if (!runner.cancel(runId)) return undefined;
      return runner.get(runId)?.run;
    },
    readTestEvents: async (runId) => runner.get(runId)?.traces ?? [],
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
      if (method === 'GET' && url.pathname === '/api/studio/session') {
        sendJson(response, 200, { capability });
        return;
      }

      const traceMatch = url.pathname.match(/^\/api\/studio\/test-runs\/([^/]+)\/events$/);
      if (method === 'GET' && traceMatch) {
        traceStream(request, response, decodeURIComponent(traceMatch[1]!), runner);
        return;
      }
      const activeRunMatch = url.pathname.match(/^\/api\/studio\/test-runs\/([^/]+)$/);
      if (method === 'GET' && activeRunMatch) {
        const snapshot = runner.get(decodeURIComponent(activeRunMatch[1]!));
        if (snapshot) {
          sendJson(response, 200, { testRun: snapshot.run });
          return;
        }
      }

      if (!url.pathname.startsWith('/api/studio/')) {
        sendJson(response, 404, { error: 'Not found' });
        return;
      }
      if (
        isMutation(method) &&
        request.headers['content-type']?.split(';', 1)[0] !== 'application/json'
      ) {
        sendJson(response, 415, { error: 'JSON content type required' });
        return;
      }
      const requestCapability = request.headers['x-studio-capability'];
      if (isMutation(method) && requestCapability !== capability) {
        sendJson(response, 403, { error: 'Mutation capability rejected' });
        return;
      }
      if (method === 'POST' && url.pathname === '/api/studio/projects/pick') {
        sendJson(response, 200, { project: await pickProject() });
        return;
      }
      if (method === 'POST' && url.pathname === '/api/studio/auth/login') {
        sendJson(response, 202, startLogin());
        return;
      }

      const apiRequest: StudioApiRequest = {
        method: method as StudioApiRequest['method'],
        path: `${url.pathname}${url.search}`,
        ...(isMutation(method) ? { body: await readJson(request), capability } : {}),
      };
      const result = await api(apiRequest);
      sendJson(response, result.status, result.body);
    } catch {
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
