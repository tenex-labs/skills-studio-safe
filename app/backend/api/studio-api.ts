import { randomUUID } from 'node:crypto';

import type {
  SkillFile,
  SkillTestCase,
  SkillTestRun,
  SkillTestTrace,
  StudioReadiness,
} from '../../domain/index.ts';
import {
  RevisionConflictError,
  SkillCatalog,
  StudioNotFoundError,
  StudioValidationError,
} from '../catalog/catalog.ts';
import type { StudioDatabase } from '../versions/database.ts';

export type StudioApiRequest = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  capability?: string;
};

export type StudioApiResponse = {
  status: number;
  body: unknown;
};

export type StudioApiOptions = {
  catalog: SkillCatalog;
  database?: StudioDatabase;
  readiness?: () => Promise<StudioReadiness> | StudioReadiness;
  launchTest?: (input: {
    skillId: string;
    versionId: string;
    testCaseId?: string;
    prompt: string;
    model: string;
    projectId?: string;
    settings?: {
      maxTurns: number;
      timeoutSeconds: number;
      effort?: string;
      toolPreset?: 'none' | 'read-only';
    };
  }) => Promise<SkillTestRun>;
  cancelTest?: (runId: string) => Promise<SkillTestRun | undefined>;
  readTestEvents?: (runId: string) => Promise<SkillTestTrace[]>;
  now?: () => string;
  id?: () => string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function string(value: unknown, field: string, required = true): string | undefined {
  if (typeof value === 'string' && (!required || value.trim().length > 0)) return value;
  if (!required && value === undefined) return undefined;
  throw new StudioValidationError(`${field} must be a non-empty string.`);
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
  throw new StudioValidationError(`${field} must be a string array.`);
}

function files(value: unknown): SkillFile[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (file) =>
        isRecord(file) &&
        typeof file.path === 'string' &&
        typeof file.content === 'string' &&
        typeof file.mode === 'number',
    )
  ) {
    throw new StudioValidationError('files must be an array of skill files.');
  }
  return value as SkillFile[];
}

function mutationCapability(request: StudioApiRequest): string {
  if (!request.capability) throw new StudioValidationError('Mutation capability is required.');
  return request.capability;
}

function segments(path: string): string[] {
  const pathname = new URL(path, 'http://studio.local').pathname;
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] === 'api' && parts[1] === 'studio' ? parts.slice(2) : parts;
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new StudioValidationError('Request body must be an object.');
  return body;
}

export function createStudioApi(options: StudioApiOptions) {
  const database = options.database ?? options.catalog.database;
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? randomUUID;

  return async function handle(request: StudioApiRequest): Promise<StudioApiResponse> {
    try {
      const route = segments(request.path);

      if (request.method === 'GET' && route.join('/') === 'readiness') {
        const readiness =
          (await options.readiness?.()) ??
          ({
            claude: { available: false, authenticated: false },
            database: 'ready',
            personalSkillsRoot: 'missing',
            activeTests: database.listTestRuns().filter(({ status }) => status === 'running')
              .length,
          } satisfies StudioReadiness);
        return { status: 200, body: readiness };
      }

      if (request.method === 'GET' && route.join('/') === 'projects') {
        return { status: 200, body: { projects: options.catalog.listProjects() } };
      }
      if (request.method === 'POST' && route.join('/') === 'projects') {
        mutationCapability(request);
        const body = bodyRecord(request.body);
        if (body.trust !== true) throw new StudioValidationError('Explicit trust is required.');
        const project = await options.catalog.registerProject({
          path: string(body.path, 'path')!,
          label: string(body.label, 'label', false),
          trust: true,
        });
        return { status: 201, body: { project } };
      }
      if (request.method === 'DELETE' && route[0] === 'projects' && route.length === 2) {
        const removed = options.catalog.removeProject(route[1]!, mutationCapability(request));
        return removed
          ? { status: 204, body: null }
          : { status: 404, body: { error: 'Not found' } };
      }

      if (request.method === 'GET' && route.join('/') === 'catalog') {
        return { status: 200, body: { skills: await options.catalog.discover() } };
      }
      if (request.method === 'POST' && route.join('/') === 'skills') {
        const body = bodyRecord(request.body);
        const scope = string(body.scope, 'scope');
        if (scope !== 'personal' && scope !== 'project') {
          throw new StudioValidationError('scope must be personal or project.');
        }
        const skill = await options.catalog.createSkill(
          {
            scope,
            projectId: string(body.projectId, 'projectId', false),
            name: string(body.name, 'name')!,
            description: string(body.description, 'description')!,
          },
          mutationCapability(request),
        );
        return { status: 201, body: { skill } };
      }
      if (request.method === 'GET' && route[0] === 'skills' && route.length === 2) {
        return { status: 200, body: { skill: await options.catalog.getSkill(route[1]!) } };
      }
      if (request.method === 'POST' && route.join('/') === 'validate') {
        const body = bodyRecord(request.body);
        const packageFiles = files(body.files);
        let directoryName = string(body.directoryName, 'directoryName', false);
        if (!directoryName && typeof body.skillId === 'string') {
          directoryName = database.getSkillRecord(body.skillId)?.summary.relativePath;
        }
        if (!directoryName)
          throw new StudioValidationError('directoryName or a known skillId is required.');
        return {
          status: 200,
          body: { validation: options.catalog.validate(packageFiles, directoryName) },
        };
      }

      if (
        request.method === 'GET' &&
        route[0] === 'skills' &&
        route[2] === 'versions' &&
        route.length === 3
      ) {
        return { status: 200, body: { versions: options.catalog.listVersions(route[1]!) } };
      }
      if (
        request.method === 'POST' &&
        route[0] === 'skills' &&
        route[2] === 'drafts' &&
        route.length === 3
      ) {
        const body = bodyRecord(request.body);
        const version = options.catalog.createDraft(
          {
            skillId: route[1]!,
            baseRevision: string(body.baseRevision, 'baseRevision')!,
            files: files(body.files),
            label: string(body.label, 'label')!,
            note: string(body.note, 'note', false),
          },
          mutationCapability(request),
        );
        return { status: 201, body: { version } };
      }
      if (
        request.method === 'GET' &&
        route[0] === 'skills' &&
        route[2] === 'test-cases' &&
        route.length === 3
      ) {
        return { status: 200, body: { testCases: database.listTestCases(route[1]!) } };
      }
      if (
        request.method === 'POST' &&
        route[0] === 'skills' &&
        route[2] === 'test-cases' &&
        route.length === 3
      ) {
        mutationCapability(request);
        if (!database.getSkillRecord(route[1]!)) throw new StudioNotFoundError('Skill not found.');
        const body = bodyRecord(request.body);
        const testCase: SkillTestCase = {
          id: id(),
          skillId: route[1]!,
          name: string(body.name, 'name')!,
          prompt: string(body.prompt, 'prompt')!,
          expectedContains: stringArray(body.expectedContains, 'expectedContains'),
          expectedExcludes: stringArray(body.expectedExcludes, 'expectedExcludes'),
          createdAt: now(),
        };
        database.saveTestCase(testCase);
        return { status: 201, body: { testCase } };
      }
      if (request.method === 'DELETE' && route[0] === 'test-cases' && route.length === 2) {
        mutationCapability(request);
        return database.deleteTestCase(route[1]!)
          ? { status: 204, body: null }
          : { status: 404, body: { error: 'Not found' } };
      }

      if (request.method === 'GET' && route.join('/') === 'test-runs') {
        return { status: 200, body: { testRuns: database.listTestRuns() } };
      }
      if (
        request.method === 'GET' &&
        route[0] === 'test-runs' &&
        route[2] === 'events' &&
        route.length === 3
      ) {
        if (!options.readTestEvents) {
          return { status: 501, body: { error: 'Test event stream unavailable' } };
        }
        return { status: 200, body: { events: await options.readTestEvents(route[1]!) } };
      }
      if (request.method === 'GET' && route[0] === 'test-runs' && route.length === 2) {
        const run = database.listTestRuns().find(({ id: runId }) => runId === route[1]);
        return run
          ? { status: 200, body: { testRun: run } }
          : { status: 404, body: { error: 'Not found' } };
      }
      if (request.method === 'POST' && route.join('/') === 'test-runs') {
        mutationCapability(request);
        if (!options.launchTest) return { status: 501, body: { error: 'Test runner unavailable' } };
        const body = bodyRecord(request.body);
        const run = await options.launchTest({
          skillId: string(body.skillId, 'skillId')!,
          versionId: string(body.versionId, 'versionId')!,
          testCaseId: string(body.testCaseId, 'testCaseId', false),
          prompt: string(body.prompt, 'prompt')!,
          model: string(body.model, 'model')!,
          projectId: string(body.projectId, 'projectId', false),
          settings:
            isRecord(body.settings) &&
            typeof body.settings.maxTurns === 'number' &&
            typeof body.settings.timeoutSeconds === 'number'
              ? {
                  maxTurns: body.settings.maxTurns,
                  timeoutSeconds: body.settings.timeoutSeconds,
                  effort:
                    typeof body.settings.effort === 'string' ? body.settings.effort : undefined,
                  toolPreset: body.settings.toolPreset === 'read-only' ? 'read-only' : 'none',
                }
              : undefined,
        });
        database.saveTestRun(run);
        return { status: 202, body: { testRun: run } };
      }
      if (
        request.method === 'POST' &&
        route[0] === 'test-runs' &&
        route[2] === 'cancel' &&
        route.length === 3
      ) {
        mutationCapability(request);
        if (!options.cancelTest) return { status: 501, body: { error: 'Test runner unavailable' } };
        const run = await options.cancelTest(route[1]!);
        if (!run) return { status: 404, body: { error: 'Not found' } };
        database.saveTestRun(run);
        return { status: 200, body: { testRun: run } };
      }

      return { status: 404, body: { error: 'Not found' } };
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        return {
          status: 409,
          body: { error: 'Revision conflict', currentRevision: error.currentRevision },
        };
      }
      if (error instanceof StudioNotFoundError) {
        return { status: 404, body: { error: error.message } };
      }
      if (error instanceof StudioValidationError) {
        return { status: 400, body: { error: error.message } };
      }
      return { status: 500, body: { error: 'Skill Studio operation failed' } };
    }
  };
}
