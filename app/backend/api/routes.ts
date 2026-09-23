import { randomUUID } from 'node:crypto';

import {
  isEffortLevel,
  isToolPreset,
  type ClaudeLoginState,
  type ClaudeStatus,
  type SkillFile,
  type SkillTestCase,
  type StudioReadiness,
  type TestRunSettings,
} from '../../domain/index.ts';
import type { SkillCatalog } from '../catalog/catalog.ts';
import { RevisionConflictError, StudioNotFoundError, StudioValidationError } from '../errors.ts';
import type { StudioDatabase } from '../storage/database.ts';
import type { SkillTestRunner } from '../testing/skill-runner.ts';

export type StudioApiRequest = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
};

export type StudioApiResponse = {
  status: number;
  body: unknown;
};

/** The operating-system and CLI effects the routes need. Tests replace these with stubs. */
export type StudioPlatform = {
  claudeStatus(): Promise<ClaudeStatus>;
  loginState(): ClaudeLoginState;
  startLogin(): { started: boolean };
  pickProject(): Promise<{ label: string; path: string }>;
  personalRootExists(): Promise<boolean>;
};

export type StudioRoutesOptions = {
  catalog: SkillCatalog;
  database: StudioDatabase;
  runner: Pick<SkillTestRunner, 'launch' | 'cancel' | 'get' | 'activeRunCount'>;
  platform: StudioPlatform;
  now?: () => string;
  id?: () => string;
};

type RouteInput = {
  params: string[];
  query: URLSearchParams;
  body: unknown;
};

type Route = {
  method: StudioApiRequest['method'];
  /** Path segments below `/api/studio`, where `:name` matches any single segment. */
  pattern: string;
  handle(input: RouteInput): Promise<StudioApiResponse> | StudioApiResponse;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new StudioValidationError('Request body must be an object.');
  return body;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new StudioValidationError(`${field} must be a non-empty string.`);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || typeof value === 'string') return value || undefined;
  throw new StudioValidationError(`${field} must be a string.`);
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
  throw new StudioValidationError(`${field} must be a string array.`);
}

function skillFiles(value: unknown): SkillFile[] {
  if (!Array.isArray(value)) throw new StudioValidationError('files must be an array.');
  return value.map((file) => {
    if (
      !isRecord(file) ||
      typeof file.path !== 'string' ||
      typeof file.content !== 'string' ||
      typeof file.mode !== 'number'
    ) {
      throw new StudioValidationError('files must contain path, content, and mode.');
    }
    return { path: file.path, content: file.content, mode: file.mode };
  });
}

function testRunSettings(value: unknown): Partial<TestRunSettings> {
  if (value === undefined) return {};
  const settings = bodyRecord(value);
  const number = (key: 'maxTurns' | 'timeoutSeconds') => {
    const field = settings[key];
    if (field === undefined || typeof field === 'number') return field;
    throw new StudioValidationError(`settings.${key} must be a number.`);
  };
  const { effort, toolPreset } = settings;
  if (effort !== undefined && !isEffortLevel(effort)) {
    throw new StudioValidationError('settings.effort is not a supported effort level.');
  }
  if (toolPreset !== undefined && !isToolPreset(toolPreset)) {
    throw new StudioValidationError('settings.toolPreset must be none or read-only.');
  }
  return {
    maxTurns: number('maxTurns'),
    timeoutSeconds: number('timeoutSeconds'),
    effort,
    toolPreset,
  };
}

function match(pattern: string, segments: string[]): string[] | undefined {
  const parts = pattern.split('/');
  if (parts.length !== segments.length) return undefined;
  const params: string[] = [];
  for (const [index, part] of parts.entries()) {
    const segment = segments[index]!;
    if (part.startsWith(':')) params.push(segment);
    else if (part !== segment) return undefined;
  }
  return params;
}

const ok = (body: unknown): StudioApiResponse => ({ status: 200, body });
const created = (body: unknown): StudioApiResponse => ({ status: 201, body });
const noContent: StudioApiResponse = { status: 204, body: null };
const notFound: StudioApiResponse = { status: 404, body: { error: 'Not found' } };

export function createStudioRoutes(options: StudioRoutesOptions) {
  const { catalog, database, runner, platform } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? randomUUID;

  const routes: Route[] = [
    {
      method: 'GET',
      pattern: 'readiness',
      async handle() {
        const readiness: StudioReadiness = {
          claude: await platform.claudeStatus(),
          authLogin: platform.loginState(),
          database: 'ready',
          personalSkillsRoot: (await platform.personalRootExists()) ? 'ready' : 'missing',
          activeTests: runner.activeRunCount,
        };
        return ok(readiness);
      },
    },
    {
      method: 'POST',
      pattern: 'auth/login',
      handle: () => ({ status: 202, body: platform.startLogin() }),
    },

    // Trusted projects
    { method: 'GET', pattern: 'projects', handle: () => ok({ projects: catalog.listProjects() }) },
    {
      method: 'POST',
      pattern: 'projects',
      async handle({ body }) {
        const input = bodyRecord(body);
        if (input.trust !== true) throw new StudioValidationError('Explicit trust is required.');
        const project = await catalog.registerProject({
          path: requiredString(input.path, 'path'),
          label: optionalString(input.label, 'label'),
          trust: true,
        });
        return created({ project });
      },
    },
    {
      method: 'POST',
      pattern: 'projects/pick',
      handle: async () => ok({ project: await platform.pickProject() }),
    },
    {
      method: 'DELETE',
      pattern: 'projects/:id',
      handle: ({ params: [projectId] }) =>
        catalog.removeProject(projectId!) ? noContent : notFound,
    },

    // Skills and versions
    {
      method: 'GET',
      pattern: 'catalog',
      handle: async () => ok({ skills: await catalog.discover() }),
    },
    {
      method: 'POST',
      pattern: 'skills',
      async handle({ body }) {
        const input = bodyRecord(body);
        if (input.scope !== 'personal' && input.scope !== 'project') {
          throw new StudioValidationError('scope must be personal or project.');
        }
        const skill = await catalog.createSkill({
          scope: input.scope,
          projectId: optionalString(input.projectId, 'projectId'),
          name: requiredString(input.name, 'name'),
          description: requiredString(input.description, 'description'),
        });
        return created({ skill });
      },
    },
    {
      method: 'GET',
      pattern: 'skills/:id',
      handle: async ({ params: [skillId] }) => ok({ skill: await catalog.getSkill(skillId!) }),
    },
    {
      method: 'GET',
      pattern: 'skills/:id/versions',
      handle: ({ params: [skillId] }) => ok({ versions: catalog.listVersions(skillId!) }),
    },
    {
      method: 'POST',
      pattern: 'skills/:id/drafts',
      handle({ params: [skillId], body }) {
        const input = bodyRecord(body);
        const version = catalog.createDraft({
          skillId: skillId!,
          baseRevision: requiredString(input.baseRevision, 'baseRevision'),
          files: skillFiles(input.files),
          label: requiredString(input.label, 'label'),
          note: optionalString(input.note, 'note'),
        });
        return created({ version });
      },
    },
    {
      method: 'POST',
      pattern: 'validate',
      handle({ body }) {
        const input = bodyRecord(body);
        let directoryName = optionalString(input.directoryName, 'directoryName');
        if (!directoryName && typeof input.skillId === 'string') {
          directoryName = database.getSkillRecord(input.skillId)?.summary.relativePath;
        }
        if (!directoryName) {
          throw new StudioValidationError('directoryName or a known skillId is required.');
        }
        return ok({ validation: catalog.validate(skillFiles(input.files), directoryName) });
      },
    },

    // Test cases
    {
      method: 'GET',
      pattern: 'skills/:id/test-cases',
      handle: ({ params: [skillId] }) => ok({ testCases: database.listTestCases(skillId!) }),
    },
    {
      method: 'POST',
      pattern: 'skills/:id/test-cases',
      handle({ params: [skillId], body }) {
        if (!database.getSkillRecord(skillId!)) throw new StudioNotFoundError('Skill not found.');
        const input = bodyRecord(body);
        const testCase: SkillTestCase = {
          id: id(),
          skillId: skillId!,
          name: requiredString(input.name, 'name'),
          prompt: requiredString(input.prompt, 'prompt'),
          expectedContains: stringArray(input.expectedContains, 'expectedContains'),
          expectedExcludes: stringArray(input.expectedExcludes, 'expectedExcludes'),
          createdAt: now(),
        };
        database.saveTestCase(testCase);
        return created({ testCase });
      },
    },
    {
      method: 'DELETE',
      pattern: 'test-cases/:id',
      handle: ({ params: [testCaseId] }) =>
        database.deleteTestCase(testCaseId!) ? noContent : notFound,
    },

    // Test runs
    {
      method: 'GET',
      pattern: 'test-runs',
      handle: ({ query }) =>
        ok({ testRuns: database.listTestRuns(query.get('skillId') ?? undefined) }),
    },
    {
      method: 'GET',
      pattern: 'test-runs/:id',
      handle({ params: [runId] }) {
        // An active run's latest state lives in the runner; the database has only its last save.
        const testRun = runner.get(runId!)?.run ?? database.getTestRun(runId!);
        return testRun ? ok({ testRun }) : notFound;
      },
    },
    {
      method: 'POST',
      pattern: 'test-runs',
      handle({ body }) {
        const input = bodyRecord(body);
        const skillId = requiredString(input.skillId, 'skillId');
        const version = database.getVersion(requiredString(input.versionId, 'versionId'));
        if (!version || version.skillId !== skillId) {
          throw new StudioNotFoundError('Version not found.');
        }
        const testCaseId = optionalString(input.testCaseId, 'testCaseId');
        const testCase = testCaseId
          ? database.listTestCases(skillId).find((candidate) => candidate.id === testCaseId)
          : undefined;
        if (testCaseId && !testCase) throw new StudioNotFoundError('Test case not found.');
        const projectId = optionalString(input.projectId, 'projectId');
        const project = projectId ? database.getTrustedProject(projectId) : undefined;
        if (projectId && !project) throw new StudioNotFoundError('Workspace not found.');

        const testRun = runner.launch({
          skill: version,
          prompt: requiredString(input.prompt, 'prompt'),
          model: requiredString(input.model, 'model'),
          testCase,
          settings: testRunSettings(input.settings),
          workspace: project && { id: project.id, label: project.label, path: project.path },
        });
        // Record the launch immediately so the run appears in history even if the server stops.
        database.saveTestRun(testRun);
        return { status: 202, body: { testRun } };
      },
    },
    {
      method: 'POST',
      pattern: 'test-runs/:id/cancel',
      handle({ params: [runId] }) {
        if (!runner.cancel(runId!)) return notFound;
        return ok({ testRun: runner.get(runId!)?.run });
      },
    },
  ];

  return async function handle(request: StudioApiRequest): Promise<StudioApiResponse> {
    try {
      const url = new URL(request.path, 'http://studio.local');
      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (segments[0] !== 'api' || segments[1] !== 'studio') return notFound;
      for (const route of routes) {
        if (route.method !== request.method) continue;
        const params = match(route.pattern, segments.slice(2));
        if (params)
          return await route.handle({ params, query: url.searchParams, body: request.body });
      }
      return notFound;
    } catch (error) {
      if (error instanceof URIError) return notFound;
      if (error instanceof RevisionConflictError) {
        return {
          status: 409,
          body: { error: 'Revision conflict', currentRevision: error.currentRevision },
        };
      }
      if (error instanceof StudioNotFoundError)
        return { status: 404, body: { error: error.message } };
      if (error instanceof StudioValidationError) {
        return { status: 400, body: { error: error.message } };
      }
      return { status: 500, body: { error: 'Skill Studio operation failed' } };
    }
  };
}
