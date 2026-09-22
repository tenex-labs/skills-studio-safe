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
  const [catalogState, setCatalogState] = useState<LoadState>('loading');
  const [catalogError, setCatalogError] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillPackage>();
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [testCases, setTestCases] = useState<SkillTestCase[]>([]);
  const [runs, setRuns] = useState<SkillTestRun[]>([]);
  const [traces, setTraces] = useState<SkillTestTrace[]>([]);
  const closeStream = useRef<() => void>(() => undefined);

  const loadReadiness = useCallback(async () => {
    try {
      setReadiness(await studioApi.readiness());
      setReadinessState('ready');
    } catch {
      setReadiness(unavailableReadiness);
      setReadinessState('error');
    }
  }, []);

  const loadCatalog = useCallback(async (scope: SkillScope, projectId?: string) => {
    setCatalogState('loading');
    setCatalogError('');
    try {
      const [nextProjects, nextSkills] = await Promise.all([
        studioApi.projects(),
        studioApi.skills(scope, projectId),
      ]);
      setProjects(nextProjects);
      setSkills(nextSkills);
      setDemoMode(false);
      setCatalogState('ready');
    } catch {
      setProjects(demoProjects);
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
    const start = window.setTimeout(() => {
      void loadReadiness();
      void loadCatalog('personal');
    }, 0);
    return () => {
      window.clearTimeout(start);
      closeStream.current();
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

  const createVersion = useCallback(
    async (input: { label: string; note?: string; files: SkillFile[] }) => {
      if (!selectedSkill) throw new Error('Select a skill before creating a draft.');
      const version = demoMode
        ? {
            id: `demo-draft-${versions.length + 1}`,
            skillId: selectedSkill.id,
            revision: `draft:${versions.length + 1}`,
            label: input.label,
            note: input.note,
            createdAt: new Date().toISOString(),
            source: 'draft' as const,
            files: input.files,
          }
        : await studioApi.createVersion(selectedSkill.id, {
            ...input,
            baseRevision: selectedSkill.revision,
          });
      setVersions((current) => [version, ...current]);
      return version;
    },
    [demoMode, selectedSkill, versions.length],
  );

  const promoteVersion = useCallback(
    async (versionId: string) => {
      if (!selectedSkill) throw new Error('Select a skill before promoting a version.');
      if (!demoMode) {
        await studioApi.promoteVersion(selectedSkill.id, versionId, selectedSkill.revision);
        const refreshedSkill = await studioApi.skill(selectedSkill.id);
        setSelectedSkill(refreshedSkill);
      }
      setVersions((current) =>
        current.map((version) =>
          version.id === versionId ? { ...version, source: 'promoted' as const } : version,
        ),
      );
    },
    [demoMode, selectedSkill],
  );

  const launchTest = useCallback(
    async (input: {
      versionId: string;
      testCaseId?: string;
      prompt: string;
      model: string;
      settings: { maxTurns: number; timeoutSeconds: number };
    }) => {
      if (!selectedSkill) throw new Error('Select a skill before launching a test.');
      closeStream.current();
      setTraces([]);
      const run = demoMode
        ? {
            ...demoRuns[0],
            id: `demo-run-${runs.length + 1}`,
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
      if (!demoMode && typeof EventSource !== 'undefined') {
        closeStream.current = studioApi.testEvents(
          run.id,
          (trace) => {
            setTraces((current) => [...current, trace]);
            if (trace.kind === 'result') {
              void studioApi.test(run.id).then((finalRun) => {
                setRuns((current) =>
                  current.map((item) => (item.id === finalRun.id ? finalRun : item)),
                );
              });
            }
          },
          () => undefined,
        );
      }
      return run;
    },
    [demoMode, runs.length, selectedSkill],
  );

  const cancelTest = useCallback(
    async (id: string) => {
      closeStream.current();
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
    catalogState,
    catalogError,
    demoMode,
    selectedSkill,
    versions,
    testCases,
    runs,
    traces,
    loadCatalog,
    openSkill,
    registerProject,
    createVersion,
    promoteVersion,
    launchTest,
    cancelTest,
  };
}
