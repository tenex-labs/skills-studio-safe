import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isTerminalStatus,
  type LaunchTestInput,
  type NewSkillTestCase,
  type SkillFile,
  type SkillPackage,
  type SkillScope,
  type SkillSummary,
  type SkillTestCase,
  type SkillTestRun,
  type SkillTestTrace,
  type SkillVersion,
  type StudioReadiness,
  type TrustedProject,
} from '../../domain/index';
import { unavailableReadiness, type LoadState } from '../model/skill-view-model';
import { studioApi } from './api';
import { createDemoApi } from './demo-api';

function inScope(skill: SkillSummary, scope: SkillScope, projectId?: string): boolean {
  return skill.scope === scope && (scope !== 'project' || skill.projectId === projectId);
}

function upsertRun(runs: SkillTestRun[], run: SkillTestRun): SkillTestRun[] {
  return runs.some(({ id }) => id === run.id)
    ? runs.map((item) => (item.id === run.id ? run : item))
    : [run, ...runs];
}

export function useStudio() {
  const [demoApi] = useState(createDemoApi);
  const [demoMode, setDemoMode] = useState(false);
  const api = demoMode ? demoApi : studioApi;

  const [readiness, setReadiness] = useState<StudioReadiness>(unavailableReadiness);
  const [readinessState, setReadinessState] = useState<LoadState>('loading');
  const [projects, setProjects] = useState<TrustedProject[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [allSkills, setAllSkills] = useState<SkillSummary[]>([]);
  const [catalogState, setCatalogState] = useState<LoadState>('loading');
  const [catalogError, setCatalogError] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SkillPackage>();
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [testCases, setTestCases] = useState<SkillTestCase[]>([]);
  const [runs, setRuns] = useState<SkillTestRun[]>([]);
  const [tracesByRun, setTracesByRun] = useState<Record<string, SkillTestTrace[]>>({});
  const closeStreams = useRef(new Map<string, () => void>());

  // Readiness always describes the real local setup, even while the catalog shows demo data.
  const loadReadiness = useCallback(async () => {
    try {
      const next = await studioApi.readiness();
      setReadiness(next);
      setReadinessState('ready');
      return next;
    } catch {
      setReadiness(unavailableReadiness);
      setReadinessState('error');
      return unavailableReadiness;
    }
  }, []);

  const loadCatalog = useCallback(
    async (scope: SkillScope, projectId?: string) => {
      setCatalogState('loading');
      setCatalogError('');
      try {
        const [nextProjects, catalog] = await Promise.all([
          studioApi.projects(),
          studioApi.catalog(),
        ]);
        setProjects(nextProjects);
        setAllSkills(catalog);
        setSkills(catalog.filter((skill) => inScope(skill, scope, projectId)));
        setDemoMode(false);
        setCatalogState('ready');
      } catch {
        const [nextProjects, catalog] = await Promise.all([demoApi.projects(), demoApi.catalog()]);
        setProjects(nextProjects);
        setAllSkills(catalog);
        setSkills(catalog.filter((skill) => inScope(skill, scope, projectId)));
        setDemoMode(true);
        setCatalogError('Studio API unavailable. Showing a labeled workshop demo catalog.');
        setCatalogState('error');
      }
    },
    [demoApi],
  );

  useEffect(() => {
    const streams = closeStreams.current;
    const start = window.setTimeout(() => {
      void loadReadiness();
      void loadCatalog('personal');
    }, 0);
    return () => {
      window.clearTimeout(start);
      for (const close of streams.values()) close();
      streams.clear();
    };
  }, [loadCatalog, loadReadiness]);

  const openSkill = useCallback(
    async (id: string) => {
      const [skill, nextVersions, nextCases, nextRuns] = await Promise.all([
        api.skill(id),
        api.versions(id),
        api.testCases(id),
        api.testRuns(id),
      ]);
      setSelectedSkill(skill);
      setVersions(nextVersions);
      setTestCases(nextCases);
      setRuns(nextRuns);
      return skill;
    },
    [api],
  );

  const registerProject = useCallback(
    async (input: { label: string; path: string }) => {
      const project = await api.registerProject(input);
      setProjects((current) => [...current.filter(({ id }) => id !== project.id), project]);
      return project;
    },
    [api],
  );

  const pickProject = useCallback(() => api.pickProject(), [api]);

  const createSkill = useCallback(
    async (input: { scope: SkillScope; projectId?: string; name: string; description: string }) => {
      const skill = await api.createSkill(input);
      const nextVersions = await api.versions(skill.id);
      setSkills((current) => [skill, ...current]);
      setAllSkills((current) => [skill, ...current]);
      setSelectedSkill(skill);
      setVersions(nextVersions);
      setTestCases([]);
      setRuns([]);
      return skill;
    },
    [api],
  );

  const reauthenticateClaude = useCallback(async () => {
    await api.startClaudeLogin();
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      const next = await loadReadiness();
      if (next.authLogin?.state === 'completed' || next.authLogin?.state === 'failed') break;
    }
  }, [api, loadReadiness]);

  const saveSkill = useCallback(
    async (input: { files: SkillFile[] }) => {
      if (!selectedSkill) throw new Error('Select a skill before saving.');
      const draft = await api.createVersion(selectedSkill.id, {
        label: `Saved ${new Date().toLocaleString()}`,
        note: 'Saved from Editor',
        files: input.files,
        baseRevision: selectedSkill.revision,
      });
      const refreshed = { ...selectedSkill, files: input.files, revision: draft.revision };
      setSelectedSkill(refreshed);
      setVersions((current) => [draft, ...current]);
      return { skill: refreshed };
    },
    [api, selectedSkill],
  );

  const saveTestCase = useCallback(
    async (input: NewSkillTestCase) => {
      if (!selectedSkill) throw new Error('Select a skill before saving a test case.');
      const testCase = await api.createTestCase(selectedSkill.id, input);
      setTestCases((current) => [...current, testCase]);
      return testCase;
    },
    [api, selectedSkill],
  );

  const stopStream = useCallback((runId: string) => {
    closeStreams.current.get(runId)?.();
    closeStreams.current.delete(runId);
  }, []);

  const refreshRun = useCallback(
    async (runId: string) => {
      const run = await api.testRun(runId);
      setRuns((current) => upsertRun(current, run));
      if (isTerminalStatus(run.status)) stopStream(runId);
    },
    [api, stopStream],
  );

  const launchTest = useCallback(
    async (input: Omit<LaunchTestInput, 'skillId'>) => {
      if (!selectedSkill) throw new Error('Select a skill before launching a test.');
      const run = await api.launchTest({ skillId: selectedSkill.id, ...input });
      setRuns((current) => upsertRun(current, run));
      setTracesByRun((current) => ({ ...current, [run.id]: [] }));

      const close = api.testEvents(
        run.id,
        (trace) => {
          // A reconnecting stream replays earlier traces, so keep each trace once.
          setTracesByRun((current) => {
            const existing = current[run.id] ?? [];
            if (existing.some(({ id }) => id === trace.id)) return current;
            return { ...current, [run.id]: [...existing, trace] };
          });
          if (trace.kind === 'result') {
            stopStream(run.id);
            void refreshRun(run.id);
          }
        },
        // The stream can drop when the run finishes and is evicted. Reconcile from the server.
        () => void refreshRun(run.id).catch(() => undefined),
      );
      closeStreams.current.set(run.id, close);
      return run;
    },
    [api, refreshRun, selectedSkill, stopStream],
  );

  const cancelTest = useCallback(
    async (id: string) => {
      // The server reports cancellation through the run's result trace once the process exits.
      const run = await api.cancelTest(id);
      setRuns((current) => upsertRun(current, run));
    },
    [api],
  );

  return {
    readiness,
    readinessState,
    projects,
    skills,
    allSkills,
    catalogState,
    catalogError,
    demoMode,
    selectedSkill,
    versions,
    testCases,
    runs,
    tracesByRun,
    loadCatalog,
    openSkill,
    createSkill,
    registerProject,
    pickProject,
    reauthenticateClaude,
    saveSkill,
    saveTestCase,
    launchTest,
    cancelTest,
  };
}
