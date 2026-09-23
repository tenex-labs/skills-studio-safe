import { KeyRound, Play } from 'lucide-react';
import { useState } from 'react';

import {
  isTerminalStatus,
  type LaunchTestInput,
  type SkillPackage,
  type SkillSummary,
  type SkillTestRun,
  type SkillTestTrace,
  type SkillVersion,
  type StudioReadiness,
  type TrustedProject,
} from '../../../domain/index';
import {
  formatCost,
  formatDuration,
  formatTokens,
  type LoadState,
} from '../../model/skill-view-model';
import { EmptyState, PageHeading, StateText } from '../../ui/components';
import { SelectMenu } from '../../ui/SelectMenu';
import { ExperimentLane } from './ExperimentLane';
import { defaultLaneConfig, toolPresetLabel, type LaneConfig } from './lane-options';

type LaneKey = 'left' | 'right';

export function TestLabView({
  skill,
  skills,
  projects,
  catalogState,
  versions,
  runs,
  tracesByRun,
  readiness,
  demoMode,
  onLaunch,
  onCancel,
  onReauthenticate,
  onSkillChange,
}: {
  skill?: SkillPackage;
  skills: SkillSummary[];
  projects: TrustedProject[];
  catalogState: LoadState;
  versions: SkillVersion[];
  runs: SkillTestRun[];
  tracesByRun: Record<string, SkillTestTrace[]>;
  readiness: StudioReadiness;
  demoMode: boolean;
  onLaunch: (input: Omit<LaunchTestInput, 'skillId'>) => Promise<SkillTestRun>;
  onCancel: (id: string) => Promise<void>;
  onReauthenticate: () => Promise<void>;
  onSkillChange: (id: string) => Promise<SkillPackage | undefined>;
}) {
  const [prompt, setPrompt] = useState('');
  const [projectId, setProjectId] = useState('');
  const [launchError, setLaunchError] = useState('');
  const [configs, setConfigs] = useState<Record<LaneKey, LaneConfig>>(() => ({
    left: defaultLaneConfig(versions[0]?.id ?? '', 'sonnet'),
    right: defaultLaneConfig(versions[1]?.id ?? versions[0]?.id ?? '', 'haiku'),
  }));
  const [runIds, setRunIds] = useState<Record<LaneKey, string | undefined>>({
    left: undefined,
    right: undefined,
  });
  const [pausedAt, setPausedAt] = useState<Record<LaneKey, number | undefined>>({
    left: undefined,
    right: undefined,
  });

  // A lane shows only the run it launched. History from other sessions never fills an empty lane.
  const laneRun = (lane: LaneKey) => runs.find(({ id }) => id === runIds[lane]);
  const laneTraces = (lane: LaneKey) => {
    const all = tracesByRun[runIds[lane] ?? ''] ?? [];
    const pause = pausedAt[lane];
    return pause === undefined ? all : all.slice(0, pause);
  };
  const leftRun = laneRun('left');
  const rightRun = laneRun('right');
  const claudeReady = readiness.claude.available && readiness.claude.authenticated;
  const canRun = Boolean(skill && prompt.trim()) && (demoMode || claudeReady);
  const anyRunning = [leftRun, rightRun].some((run) => run && !isTerminalStatus(run.status));
  const loginCompleted = readiness.authLogin?.state === 'completed';
  const authenticationFailed =
    !loginCompleted &&
    [leftRun, rightRun].some((run) => run?.output?.includes('OAuth access token has expired'));

  const launchLane = async (lane: LaneKey) => {
    const config = configs[lane];
    setLaunchError('');
    setPausedAt((current) => ({ ...current, [lane]: undefined }));
    try {
      const run = await onLaunch({
        versionId: config.versionId,
        prompt,
        model: config.model,
        projectId: projectId || undefined,
        settings: {
          maxTurns: config.maxTurns,
          timeoutSeconds: config.timeoutSeconds,
          effort: config.effort,
          toolPreset: config.toolPreset,
        },
      });
      setRunIds((current) => ({ ...current, [lane]: run.id }));
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'The run could not start.');
    }
  };

  const togglePause = (lane: LaneKey) =>
    setPausedAt((current) => ({
      ...current,
      [lane]:
        current[lane] === undefined ? (tracesByRun[runIds[lane] ?? ''] ?? []).length : undefined,
    }));

  const versionLabel = (versionId: string) =>
    versions.find(({ id }) => id === versionId)?.label ?? 'Unavailable';
  const workspaceLabel = projects.find(({ id }) => id === projectId)?.label ?? 'Studio sandbox';
  const sharedMetadata: Array<[string, string, string]> = [
    ['Status', leftRun?.status ?? 'Not run', rightRun?.status ?? 'Not run'],
    ['Version', versionLabel(configs.left.versionId), versionLabel(configs.right.versionId)],
    ['Model', configs.left.model, configs.right.model],
    ['Effort', configs.left.effort, configs.right.effort],
    ['Workspace', workspaceLabel, workspaceLabel],
    ['Access', toolPresetLabel(configs.left.toolPreset), toolPresetLabel(configs.right.toolPreset)],
    ['Duration', formatDuration(leftRun?.durationMs), formatDuration(rightRun?.durationMs)],
    ['Tokens', formatTokens(leftRun), formatTokens(rightRun)],
    ['Cost', formatCost(leftRun), formatCost(rightRun)],
  ];

  const skillOptions = skills.map((item) => ({
    value: item.id,
    label: item.name,
    description: `${item.scope} · ${item.relativePath}`,
  }));

  if (!skill) {
    return (
      <>
        <PageHeading
          title="Test lab"
          description="Run two headless Claude Code configurations against the same prompt."
        />
        <section className="panel test-lab-start" aria-labelledby="choose-skill-title">
          <div className="test-lab-start-copy">
            <span>Start an experiment</span>
            <h2 id="choose-skill-title">Choose a skill to compare</h2>
            <p>
              Pick a personal or project skill, then vary model, effort, version, and repository
              access side by side.
            </p>
            <div className="test-lab-skill-menu">
              <SelectMenu
                label="Skill"
                value=""
                placeholder="Search or choose a skill"
                options={skillOptions}
                onChange={(id) => void onSkillChange(id)}
                hideLabel
                searchable
              />
            </div>
          </div>
          {skills.length > 0 ? (
            <div className="recent-skills">
              <span>Quick start</span>
              {skills.slice(0, 6).map((item) => (
                <button key={item.id} onClick={() => void onSkillChange(item.id)}>
                  <strong>{item.name}</strong>
                  <small>{item.scope}</small>
                </button>
              ))}
            </div>
          ) : catalogState === 'loading' ? (
            <div className="recent-skills loading-skills">Loading local skills…</div>
          ) : (
            <EmptyState title="No skills available">
              Create a skill in Library, then return here to test it.
            </EmptyState>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Test lab"
        description={`Compare two ${skill.name} configurations against the same input.`}
        action={
          <StateText tone={demoMode || claudeReady ? 'success' : 'warning'}>
            {demoMode
              ? 'Demo runner'
              : `Claude account ${readiness.claude.authenticated ? 'found' : 'required'}${readiness.claude.version ? ` · ${readiness.claude.version}` : ''}`}
          </StateText>
        }
      />
      {(authenticationFailed || readiness.authLogin?.state === 'running' || loginCompleted) && (
        <div
          className={`notice ${loginCompleted ? 'success' : 'warning'} auth-recovery`}
          role="status"
        >
          <div>
            <strong>
              {loginCompleted
                ? 'Claude sign-in completed'
                : readiness.authLogin?.state === 'running'
                  ? 'Claude sign-in is open'
                  : 'Claude needs a fresh sign-in'}
            </strong>
            <p>
              {loginCompleted
                ? 'Run either configuration again to verify the refreshed session.'
                : 'Complete the official Claude flow, then rerun the experiment.'}
            </p>
          </div>
          {!loginCompleted && readiness.authLogin?.state !== 'running' && (
            <button className="button secondary" onClick={() => void onReauthenticate()}>
              <KeyRound size={17} aria-hidden="true" />
              Re-authenticate Claude
            </button>
          )}
        </div>
      )}
      {launchError && (
        <p className="notice warning" role="alert">
          {launchError}
        </p>
      )}
      <section className="shared-experiment panel" aria-labelledby="shared-input-title">
        <div className="panel-heading">
          <div>
            <h2 id="shared-input-title">Shared test input</h2>
            <span>Runs two headless Claude Code instances with the same prompt and workspace</span>
          </div>
          <button
            className="button primary"
            disabled={!canRun || anyRunning || !configs.left.versionId || !configs.right.versionId}
            onClick={() => void Promise.all([launchLane('left'), launchLane('right')])}
          >
            <Play size={17} aria-hidden="true" />
            Run both
          </button>
        </div>
        <div className="shared-input-grid">
          <SelectMenu
            label="Skill"
            value={skill.id}
            placeholder="Choose a skill"
            options={skillOptions}
            onChange={(id) => void onSkillChange(id)}
            searchable
          />
          <SelectMenu
            label="Workspace"
            value={projectId}
            placeholder="Isolated Studio sandbox"
            options={[
              { value: '', label: 'Isolated Studio sandbox', description: 'No repository context' },
              ...projects.map((project) => ({
                value: project.id,
                label: project.label,
                description: project.path,
              })),
            ]}
            onChange={setProjectId}
          />
          <label className="prompt-field">
            Prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Write the request both configurations will receive, as you would type it to Claude."
            />
          </label>
        </div>
      </section>
      <div className="experiment-grid">
        {(['left', 'right'] as const).map((lane) => (
          <ExperimentLane
            key={lane}
            label={lane === 'left' ? 'Configuration A' : 'Configuration B'}
            config={configs[lane]}
            versions={versions}
            run={laneRun(lane)}
            traces={laneTraces(lane)}
            paused={pausedAt[lane] !== undefined}
            canRun={canRun && Boolean(configs[lane].versionId)}
            onConfigChange={(config) => setConfigs((current) => ({ ...current, [lane]: config }))}
            onRun={() => void launchLane(lane)}
            onCancel={() => {
              const run = laneRun(lane);
              if (run) void onCancel(run.id);
            }}
            onPause={() => togglePause(lane)}
          />
        ))}
      </div>
      <section className="panel experiment-comparison" aria-label="Aligned run metadata">
        <div className="comparison-row comparison-header">
          <span>Evidence</span>
          <strong>Configuration A</strong>
          <strong>Configuration B</strong>
        </div>
        {sharedMetadata.map(([label, left, right]) => (
          <div className="comparison-row" key={label}>
            <span>{label}</span>
            <p>{left}</p>
            <p>{right}</p>
          </div>
        ))}
      </section>
    </>
  );
}
