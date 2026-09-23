import type {
  SkillFile,
  SkillPackage,
  SkillScope,
  SkillSummary,
  SkillTestCase,
  SkillTestRun,
  SkillTestTrace,
  SkillVersion,
  StudioReadiness,
  TrustedProject,
} from '../../domain/index';

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' };
const apiRoot = '/api/studio';
let capability: string | undefined;

async function mutationCapability(): Promise<string> {
  if (capability) return capability;
  const response = await fetch(`${apiRoot}/session`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Studio session is unavailable.');
  const body = (await response.json()) as { capability?: unknown };
  if (typeof body.capability !== 'string') throw new Error('Studio session is invalid.');
  capability = body.capability;
  return capability;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...jsonHeaders };
  if (init?.method && init.method !== 'GET') {
    headers['X-Studio-Capability'] = await mutationCapability();
  }
  const response = await fetch(path, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`Studio API request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function listFrom<T>(value: T[] | Record<string, T[]>, key: string): T[] {
  return Array.isArray(value) ? value : (value[key] ?? []);
}

export const studioApi = {
  readiness: () => request<StudioReadiness>(`${apiRoot}/readiness`),
  projects: async () => {
    const value = await request<TrustedProject[] | { projects: TrustedProject[] }>(
      `${apiRoot}/projects`,
    );
    return listFrom(value, 'projects');
  },
  registerProject: async (input: { label: string; path: string }) => {
    const value = await request<TrustedProject | { project: TrustedProject }>(
      `${apiRoot}/projects`,
      { method: 'POST', body: JSON.stringify({ ...input, trust: true }) },
    );
    return 'project' in value ? value.project : value;
  },
  pickProject: () =>
    request<{ project: { label: string; path: string } }>(`${apiRoot}/projects/pick`, {
      method: 'POST',
      body: '{}',
    }).then(({ project }) => project),
  startClaudeLogin: () =>
    request<{ started: boolean }>(`${apiRoot}/auth/login`, {
      method: 'POST',
      body: '{}',
    }),
  catalog: async () => {
    const value = await request<SkillSummary[] | { skills: SkillSummary[] }>(`${apiRoot}/catalog`);
    return listFrom(value, 'skills');
  },
  skills: async (scope: SkillScope, projectId?: string) => {
    const skills = await studioApi.catalog();
    return skills.filter(
      (skill) => skill.scope === scope && (scope !== 'project' || skill.projectId === projectId),
    );
  },
  createSkill: (input: {
    scope: SkillScope;
    projectId?: string;
    name: string;
    description: string;
  }) =>
    request<{ skill: SkillPackage }>(`${apiRoot}/skills`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then(({ skill }) => skill),
  skill: async (id: string) => {
    const value = await request<SkillPackage | { skill: SkillPackage }>(
      `${apiRoot}/skills/${encodeURIComponent(id)}`,
    );
    return 'skill' in value ? value.skill : value;
  },
  versions: async (id: string) => {
    const value = await request<SkillVersion[] | { versions: SkillVersion[] }>(
      `${apiRoot}/skills/${encodeURIComponent(id)}/versions`,
    );
    return listFrom(value, 'versions');
  },
  createVersion: async (
    id: string,
    input: { label: string; note?: string; files: SkillFile[]; baseRevision: string },
  ) => {
    const value = await request<SkillVersion | { version: SkillVersion }>(
      `${apiRoot}/skills/${encodeURIComponent(id)}/drafts`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
    return 'version' in value ? value.version : value;
  },
  testCases: async (id: string) => {
    const value = await request<SkillTestCase[] | { testCases: SkillTestCase[] }>(
      `${apiRoot}/skills/${encodeURIComponent(id)}/test-cases`,
    );
    return listFrom(value, 'testCases');
  },
  createTestCase: (id: string, input: Omit<SkillTestCase, 'id' | 'skillId' | 'createdAt'>) =>
    request<{ testCase: SkillTestCase }>(`${apiRoot}/skills/${encodeURIComponent(id)}/test-cases`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then(({ testCase }) => testCase),
  testRuns: async (skillId?: string) => {
    const value = await request<SkillTestRun[] | { testRuns: SkillTestRun[] }>(
      `${apiRoot}/test-runs`,
    );
    const runs = listFrom(value, 'testRuns');
    return skillId ? runs.filter((run) => run.skillId === skillId) : runs;
  },
  launchTest: (input: {
    skillId: string;
    versionId: string;
    testCaseId?: string;
    prompt: string;
    model: string;
    projectId?: string;
    settings: {
      maxTurns: number;
      timeoutSeconds: number;
      effort: string;
      toolPreset: 'none' | 'read-only';
    };
  }) =>
    request<{ testRun: SkillTestRun }>(`${apiRoot}/test-runs`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then(({ testRun }) => testRun),
  test: (id: string) =>
    request<{ testRun: SkillTestRun }>(`${apiRoot}/test-runs/${encodeURIComponent(id)}`).then(
      ({ testRun }) => testRun,
    ),
  cancelTest: (id: string) =>
    request<{ testRun: SkillTestRun }>(`${apiRoot}/test-runs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: '{}',
    }).then(({ testRun }) => testRun),
  testEvents: (id: string, onTrace: (trace: SkillTestTrace) => void, onError: () => void) => {
    const source = new EventSource(`${apiRoot}/test-runs/${encodeURIComponent(id)}/events`);
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

export type StudioApi = typeof studioApi;
