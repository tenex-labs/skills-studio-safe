import {
  evaluateAssertions,
  type SkillTestRun,
  type SkillTestTrace,
  type SkillTestTraceInput,
  type TerminalTestStatus,
} from '../../domain/index';
import { demoProjects, demoRuns, demoSkills, demoTestCases, demoVersions } from '../fixtures/demo';
import { unavailableReadiness } from '../model/skill-view-model';
import type { StudioApi } from './api';

const DEMO_RUN_MS = 400;

function unavailable(): Promise<never> {
  return Promise.reject(new Error('This action needs the local Studio server.'));
}

/**
 * An in-memory StudioApi used when the local server is unreachable. It behaves like the live API
 * closely enough that the UI has one code path, but it never touches the filesystem or Claude.
 */
export function createDemoApi(): StudioApi {
  const skills = structuredClone(demoSkills);
  const versions = structuredClone(demoVersions);
  const testCases = structuredClone(demoTestCases);
  const runs = structuredClone(demoRuns);
  const listeners = new Map<string, (trace: SkillTestTrace) => void>();
  const timers = new Map<string, number>();
  let nextId = 0;

  const newId = (prefix: string) => `demo-${prefix}-${++nextId}`;
  const emit = (runId: string, trace: SkillTestTraceInput) =>
    listeners.get(runId)?.({ ...trace, id: newId('trace'), timestamp: new Date().toISOString() });

  const finish = (run: SkillTestRun, status: TerminalTestStatus) => {
    window.clearTimeout(timers.get(run.id));
    timers.delete(run.id);
    if (status === 'passed') {
      run.output = `Demo response from ${run.model}. No model was called.`;
      emit(run.id, { kind: 'assistant', text: run.output });
      run.durationMs = DEMO_RUN_MS;
      const testCase = testCases.find(({ id }) => id === run.testCaseId);
      run.assertions = evaluateAssertions(testCase, run.output);
    }
    run.status = status;
    run.finishedAt = new Date().toISOString();
    emit(run.id, { kind: 'result', status });
  };

  const findRun = (id: string) => {
    const run = runs.find((candidate) => candidate.id === id);
    return run ? Promise.resolve(structuredClone(run)) : unavailable();
  };

  return {
    readiness: async () => unavailableReadiness,
    projects: async () => structuredClone(demoProjects),
    registerProject: unavailable,
    pickProject: unavailable,
    startClaudeLogin: unavailable,
    catalog: async () => structuredClone(skills),
    createSkill: unavailable,
    async skill(id) {
      const skill = skills.find((candidate) => candidate.id === id);
      return skill ? structuredClone(skill) : unavailable();
    },
    versions: async (skillId) =>
      structuredClone(versions.filter((version) => version.skillId === skillId)),
    async createVersion(skillId, input) {
      const skill = skills.find((candidate) => candidate.id === skillId);
      if (!skill) return unavailable();
      const version = {
        id: newId('version'),
        skillId,
        revision: `demo:${++nextId}`,
        label: input.label,
        note: input.note,
        createdAt: new Date().toISOString(),
        source: 'draft' as const,
        files: input.files,
      };
      versions.unshift(version);
      skill.files = input.files;
      skill.revision = version.revision;
      return structuredClone(version);
    },
    testCases: async (skillId) =>
      structuredClone(testCases.filter((testCase) => testCase.skillId === skillId)),
    async createTestCase(skillId, input) {
      const testCase = {
        ...input,
        id: newId('case'),
        skillId,
        createdAt: new Date().toISOString(),
      };
      testCases.push(testCase);
      return structuredClone(testCase);
    },
    testRuns: async (skillId) => structuredClone(runs.filter((run) => run.skillId === skillId)),
    async launchTest(input) {
      const run: SkillTestRun = {
        id: newId('run'),
        skillId: input.skillId,
        versionId: input.versionId,
        testCaseId: input.testCaseId,
        prompt: input.prompt,
        model: input.model,
        effort: input.settings.effort,
        toolPreset: input.settings.toolPreset,
        status: 'running',
        startedAt: new Date().toISOString(),
        assertions: [],
      };
      runs.unshift(run);
      timers.set(
        run.id,
        window.setTimeout(() => finish(run, 'passed'), DEMO_RUN_MS),
      );
      return structuredClone(run);
    },
    testRun: findRun,
    async cancelTest(id) {
      const run = runs.find((candidate) => candidate.id === id);
      if (!run) return unavailable();
      if (run.status === 'running') finish(run, 'cancelled');
      return structuredClone(run);
    },
    testEvents(id, onTrace) {
      listeners.set(id, onTrace);
      return () => {
        listeners.delete(id);
      };
    },
  };
}
