import type {
  LaunchTestInput,
  SkillFile,
  SkillPackage,
  SkillScope,
  SkillSummary,
  SkillTestRun,
  SkillTestTrace,
  SkillVersion,
  StudioReadiness,
  TrustedProject,
} from '../../domain/index';

/** Everything the UI can ask of the Studio. The live client and the demo client both implement it. */
export interface StudioApi {
  readiness(): Promise<StudioReadiness>;
  projects(): Promise<TrustedProject[]>;
  registerProject(input: { label: string; path: string }): Promise<TrustedProject>;
  /** Forgets a trusted project and the versions and runs Studio saved for it. */
  forgetProject(id: string): Promise<void>;
  pickProject(): Promise<{ label: string; path: string }>;
  startClaudeLogin(): Promise<{ started: boolean }>;
  catalog(): Promise<SkillSummary[]>;
  createSkill(input: {
    scope: SkillScope;
    projectId?: string;
    name: string;
    description: string;
  }): Promise<SkillPackage>;
  skill(id: string): Promise<SkillPackage>;
  versions(skillId: string): Promise<SkillVersion[]>;
  createVersion(
    skillId: string,
    input: { label: string; note?: string; files: SkillFile[]; baseRevision: string },
  ): Promise<SkillVersion>;
  testRuns(skillId: string): Promise<SkillTestRun[]>;
  launchTest(input: LaunchTestInput): Promise<SkillTestRun>;
  testRun(id: string): Promise<SkillTestRun>;
  cancelTest(id: string): Promise<SkillTestRun>;
  /** Streams a run's traces until its result trace. Returns a function that stops the stream. */
  testEvents(id: string, onTrace: (trace: SkillTestTrace) => void, onError: () => void): () => void;
}

const apiRoot = '/api/studio';
const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' };
let capability: string | undefined;

export class StudioApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function mutationCapability(): Promise<string> {
  if (capability) return capability;
  const response = await fetch(`${apiRoot}/session`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new StudioApiError(response.status, 'Studio session is unavailable.');
  const body = (await response.json()) as { capability?: unknown };
  if (typeof body.capability !== 'string') throw new Error('Studio session is invalid.');
  capability = body.capability;
  return capability;
}

async function request<T>(
  path: string,
  init?: { method: 'POST'; body: unknown } | { method: 'DELETE' },
): Promise<T> {
  const headers: Record<string, string> = { ...jsonHeaders };
  if (init) headers['X-Studio-Capability'] = await mutationCapability();
  const response = await fetch(`${apiRoot}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    ...(init && 'body' in init ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    // The server returns safe, user-facing messages for validation and not-found errors.
    const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined;
    const message = typeof body?.error === 'string' ? body.error : 'Studio request failed.';
    throw new StudioApiError(response.status, message);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body });
const segment = encodeURIComponent;

export const studioApi: StudioApi = {
  readiness: () => request<StudioReadiness>('/readiness'),
  projects: () =>
    request<{ projects: TrustedProject[] }>('/projects').then(({ projects }) => projects),
  registerProject: (input) =>
    post<{ project: TrustedProject }>('/projects', { ...input, trust: true }).then(
      ({ project }) => project,
    ),
  forgetProject: (id) =>
    request<unknown>(`/projects/${segment(id)}`, { method: 'DELETE' }).then(() => undefined),
  pickProject: () =>
    post<{ project: { label: string; path: string } }>('/projects/pick').then(
      ({ project }) => project,
    ),
  startClaudeLogin: () => post<{ started: boolean }>('/auth/login'),
  catalog: () => request<{ skills: SkillSummary[] }>('/catalog').then(({ skills }) => skills),
  createSkill: (input) =>
    post<{ skill: SkillPackage }>('/skills', input).then(({ skill }) => skill),
  skill: (id) =>
    request<{ skill: SkillPackage }>(`/skills/${segment(id)}`).then(({ skill }) => skill),
  versions: (skillId) =>
    request<{ versions: SkillVersion[] }>(`/skills/${segment(skillId)}/versions`).then(
      ({ versions }) => versions,
    ),
  createVersion: (skillId, input) =>
    post<{ version: SkillVersion }>(`/skills/${segment(skillId)}/drafts`, input).then(
      ({ version }) => version,
    ),
  testRuns: (skillId) =>
    request<{ testRuns: SkillTestRun[] }>(`/test-runs?skillId=${segment(skillId)}`).then(
      ({ testRuns }) => testRuns,
    ),
  launchTest: (input) =>
    post<{ testRun: SkillTestRun }>('/test-runs', input).then(({ testRun }) => testRun),
  testRun: (id) =>
    request<{ testRun: SkillTestRun }>(`/test-runs/${segment(id)}`).then(({ testRun }) => testRun),
  cancelTest: (id) =>
    post<{ testRun: SkillTestRun }>(`/test-runs/${segment(id)}/cancel`).then(
      ({ testRun }) => testRun,
    ),
  testEvents(id, onTrace, onError) {
    const source = new EventSource(`${apiRoot}/test-runs/${segment(id)}/events`);
    source.onmessage = ({ data }) => {
      try {
        onTrace(JSON.parse(data) as SkillTestTrace);
      } catch {
        onError();
      }
    };
    source.onerror = onError;
    return () => source.close();
  },
};
