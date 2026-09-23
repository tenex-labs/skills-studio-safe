import { useCallback, useEffect, useRef, useState } from 'react';
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
import { demoProjects, demoRuns, demoSkills, demoTestCases, demoVersions } from '../fixtures/demo';
import { unavailableReadiness, type LoadState } from '../model/skill-view-model';
import { studioApi } from './api';

export function useStudio() {
  const [readiness, setReadiness] = useState<StudioReadiness>(unavailableReadiness);
  const [readinessState, setReadinessState] = useState<LoadState>('loading');
  const [projects, setProjects] = useState<TrustedProject[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [allSkills, setAllSkills] = useState<SkillSummary[]>([]);
  const [catalogState, setCatalogState] = useState<LoadState>('loading');
  const [catalogError, setCatalogError] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillPackage>();
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [testCases, setTestCases] = useState<SkillTestCase[]>([]);
  const [runs, setRuns] = useState<SkillTestRun[]>([]);
  const [tracesByRun, setTracesByRun] = useState<Record<string, SkillTestTrace[]>>({});
  const closeStreams = useRef(new Map<string, () => void>());
  const demoRunCounter = useRef(0);

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

  const loadCatalog = useCallback(async (scope: SkillScope, projectId?: string) => {
    setCatalogState('loading');
    setCatalogError('');
    try {
      const [nextProjects, catalog] = await Promise.all([
        studioApi.projects(),
        studioApi.catalog(),
      ]);
      const nextSkills = catalog.filter(
        (skill) => skill.scope === scope && (scope !== 'project' || skill.projectId === projectId),
      );
      setProjects(nextProjects);
      setAllSkills(catalog);
      setSkills(nextSkills);
      setDemoMode(false);
      setCatalogState('ready');
    } catch {
      setProjects(demoProjects);
      setAllSkills(demoSkills);
      setSkills(
        demoSkills.filter(
          (skill) =>
            skill.scope === scope && (scope !== 'project' || skill.projectId === projectId),
        ),
      );
      setDemoMode(true);
      setCatalogError('Studio API unavailable. Showing a labeled workshop demo catalog.');
      setCatalogState('error');
    }
  }, []);

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
      if (demoMode || id.startsWith('demo-')) {
        const skill = demoSkills.find((item) => item.id === id);
        setSelectedSkill(skill);
        setVersions(demoVersions.filter((version) => version.skillId === id));
        setTestCases(demoTestCases.filter((testCase) => testCase.skillId === id));
        setRuns(demoRuns.filter((run) => run.skillId === id));
        return skill;
      }
      const [skill, nextVersions, nextCases, nextRuns] = await Promise.all([
        studioApi.skill(id),
        studioApi.versions(id),
        studioApi.testCases(id),
        studioApi.testRuns(id),
      ]);
      setSelectedSkill(skill);
      setVersions(nextVersions);
      setTestCases(nextCases);
      setRuns(nextRuns);
      return skill;
    },
    [demoMode],
  );

  const registerProject = useCallback(async (input: { label: string; path: string }) => {
    const project = await studioApi.registerProject(input);
    setProjects((current) => [...current, project]);
    return project;
  }, []);

  const pickProject = useCallback(() => studioApi.pickProject(), []);

  const createSkill = useCallback(
    async (input: { scope: SkillScope; projectId?: string; name: string; description: string }) => {
      const skill = await studioApi.createSkill(input);
      const nextVersions = await studioApi.versions(skill.id);
      setSkills((current) => [skill, ...current]);
      setAllSkills((current) => [skill, ...current]);
      setSelectedSkill(skill);
      setVersions(nextVersions);
      setTestCases([]);
      setRuns([]);
      return skill;
    },
    [],
  );

  const reauthenticateClaude = useCallback(async () => {
    await studioApi.startClaudeLogin();
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      const next = await loadReadiness();
      if (next.authLogin?.state === 'completed' || next.authLogin?.state === 'failed') break;
    }
  }, [loadReadiness]);

  const saveSkill = useCallback(
    async (input: { files: SkillFile[] }) => {
      if (!selectedSkill) throw new Error('Select a skill before saving.');
      if (demoMode) {
        const refreshed = {
          ...selectedSkill,
          revision: `demo-saved:${Date.now()}`,
          files: input.files,
        };
        const version = {
          id: `demo-saved-${versions.length + 1}`,
          skillId: refreshed.id,
          revision: refreshed.revision,
          label: 'Saved Studio version',
          note: 'Saved from Editor',
          createdAt: new Date().toISOString(),
          source: 'draft' as const,
          files: input.files,
        };
        setSelectedSkill(refreshed);
        setVersions((current) => [version, ...current]);
        return { skill: refreshed };
      }
      const draft = await studioApi.createVersion(selectedSkill.id, {
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
    [demoMode, selectedSkill, versions.length],
  );

  const launchTest = useCallback(
    async (input: {
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
    }) => {
      if (!selectedSkill) throw new Error('Select a skill before launching a test.');
      const run = demoMode
        ? {
            ...demoRuns[0],
            id: `demo-run-${++demoRunCounter.current}`,
            versionId: input.versionId,
            testCaseId: input.testCaseId,
            prompt: input.prompt,
            model: input.model,
            status: 'running' as const,
            output: undefined,
            assertions: [],
          }
        : await studioApi.launchTest({ skillId: selectedSkill.id, ...input });
      setRuns((current) => [run, ...current.filter(({ id }) => id !== run.id)]);
      setTracesByRun((current) => ({ ...current, [run.id]: [] }));
      if (demoMode) {
        window.setTimeout(() => {
          const output = `Demo response from ${input.model} using the selected skill version.`;
          setTracesByRun((current) => ({
            ...current,
            [run.id]: [
              {
                id: `${run.id}-assistant`,
                timestamp: new Date().toISOString(),
                kind: 'assistant',
                text: output,
              },
              {
                id: `${run.id}-result`,
                timestamp: new Date().toISOString(),
                kind: 'result',
                status: 'passed',
              },
            ],
          }));
          setRuns((current) =>
            current.map((item) =>
              item.id === run.id
                ? {
                    ...item,
                    status: 'passed',
                    output,
                    durationMs: 800,
                    assertions: [],
                  }
                : item,
            ),
          );
        }, 250);
      }
      if (!demoMode && typeof EventSource !== 'undefined') {
        const close = studioApi.testEvents(
          run.id,
          (trace) => {
            setTracesByRun((current) => ({
              ...current,
              [run.id]: [...(current[run.id] ?? []), trace],
            }));
            if (trace.kind === 'result') {
              void studioApi.test(run.id).then((finalRun) => {
                setRuns((current) =>
                  current.map((item) => (item.id === finalRun.id ? finalRun : item)),
                );
                closeStreams.current.get(run.id)?.();
                closeStreams.current.delete(run.id);
              });
            }
          },
          () => undefined,
        );
        closeStreams.current.set(run.id, close);
      }
      return run;
    },
    [demoMode, selectedSkill],
  );

  const cancelTest = useCallback(
    async (id: string) => {
      closeStreams.current.get(id)?.();
      closeStreams.current.delete(id);
      const run = demoMode ? runs.find((item) => item.id === id) : await studioApi.cancelTest(id);
      if (!run) return;
      const cancelled = { ...run, status: 'cancelled' as const };
      setRuns((current) => current.map((item) => (item.id === id ? cancelled : item)));
    },
    [demoMode, runs],
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
    launchTest,
    cancelTest,
  };
}
