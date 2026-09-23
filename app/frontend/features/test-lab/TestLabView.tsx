import { KeyRound, Pause, Play, Square } from 'lucide-react';
import { useState } from 'react';

import type {
  SkillPackage,
  SkillSummary,
  SkillTestRun,
  SkillTestTrace,
  SkillVersion,
  StudioReadiness,
  TrustedProject,
} from '../../../domain/index';
import { formatCost, formatDuration, formatTokens } from '../../model/skill-view-model';
import type { LoadState } from '../../model/skill-view-model';
import { EmptyState, PageHeading, StateText } from '../../ui/components';
import { SelectMenu } from '../../ui/SelectMenu';

type LaneKey = 'left' | 'right';
type LaneConfig = {
  versionId: string;
  model: string;
  effort: string;
  toolPreset: 'none' | 'read-only';
  maxTurns: number;
  timeoutSeconds: number;
};

const modelOptions = [
  { value: 'default', label: 'Account default', description: 'Uses your configured default' },
  { value: 'best', label: 'Best available', description: 'Fable when available, otherwise Opus' },
  { value: 'fable', label: 'Latest Fable', description: 'Moving family alias' },
  { value: 'opus', label: 'Latest Opus', description: 'Moving family alias' },
  { value: 'sonnet', label: 'Latest Sonnet', description: 'Moving family alias' },
  { value: 'haiku', label: 'Latest Haiku', description: 'Moving family alias' },
  { value: 'opusplan', label: 'Opus plan / Sonnet execute', description: 'Hybrid mode' },
  { value: 'opus[1m]', label: 'Latest Opus · 1M context', description: 'Plan dependent' },
  { value: 'sonnet[1m]', label: 'Latest Sonnet · 1M context', description: 'Gateway dependent' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1', description: 'Deepest reasoning' },
  { value: 'claude-opus-5', label: 'Claude Opus 5', description: 'Complex agentic work' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5', description: 'Fast and capable' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fastest and lowest cost' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8', description: 'Legacy' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: 'Legacy' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Legacy' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5', description: 'Legacy' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Legacy' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', description: 'Legacy' },
];

const effortOptions = [
  { value: 'low', label: 'Low', description: 'Fastest' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High', description: 'Model default' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Maximum' },
  { value: 'ultracode', label: 'Ultracode', description: 'Claude Code 2.1.203+' },
];

function availableModel(value: string | undefined, fallback: string): string {
  return value && modelOptions.some((option) => option.value === value) ? value : fallback;
}

function assembledAssistantOutput(traces: SkillTestTrace[]): string {
  return traces
    .filter((trace): trace is Extract<SkillTestTrace, { kind: 'assistant' }> => {
      return trace.kind === 'assistant';
    })
    .map(({ text }) => text)
    .join('');
}

function traceText(trace: SkillTestTrace): string {
  if (trace.kind === 'assistant') return trace.text;
  if (trace.kind === 'warning') return trace.message;
  if (trace.kind === 'tool') return `${trace.name}: ${trace.status}`;
  if (trace.kind === 'process') return trace.state;
  return trace.status;
}

function toneFor(status?: SkillTestRun['status']) {
  if (status === 'passed') return 'success';
  if (status === 'failed' || status === 'timed-out') return 'danger';
  if (status === 'running' || status === 'queued') return 'accent';
  return 'neutral';
}

function ExperimentLane({
  label,
  config,
  versions,
  run,
  traces,
  paused,
  canRun,
  onConfigChange,
  onRun,
  onCancel,
  onPause,
}: {
  label: string;
  config: LaneConfig;
  versions: SkillVersion[];
  run?: SkillTestRun;
  traces: SkillTestTrace[];
  paused: boolean;
  canRun: boolean;
  onConfigChange: (config: LaneConfig) => void;
  onRun: () => void;
  onCancel: () => void;
  onPause: () => void;
}) {
  const output = run?.output || assembledAssistantOutput(traces);
  const diagnosticTraces = traces.filter((trace) => trace.kind !== 'assistant');
  const running = run?.status === 'running' || run?.status === 'queued';

  return (
    <section className="experiment-lane panel" aria-label={`${label} configuration and result`}>
      <div className="experiment-lane-heading">
        <div>
          <span>{label}</span>
          <StateText tone={toneFor(run?.status)}>{run?.status ?? 'Not run'}</StateText>
        </div>
        <div className="button-row">
          <button
            className="button secondary compact-action"
            disabled={!canRun || running}
            onClick={onRun}
          >
            <Play size={15} aria-hidden="true" />
            Run
          </button>
          <button
            className="icon-button compact"
            aria-label={`${paused ? 'Resume' : 'Pause'} ${label} trace`}
            aria-pressed={paused}
            disabled={traces.length === 0}
            onClick={onPause}
          >
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
          <button
            className="icon-button compact danger"
            aria-label={`Cancel ${label} run`}
            disabled={!running}
            onClick={onCancel}
          >
            <Square aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="lane-primary-config">
        <SelectMenu
          label="Model"
          value={config.model}
          placeholder="Choose a model"
          options={modelOptions}
          onChange={(model) => onConfigChange({ ...config, model })}
        />
        <SelectMenu
          label="Effort"
          value={config.effort}
          placeholder="Choose effort"
          options={effortOptions}
          onChange={(effort) => onConfigChange({ ...config, effort })}
        />
      </div>
      <details className="advanced-settings">
        <summary>Advanced settings</summary>
        <div className="lane-config">
          <SelectMenu
            label="Skill version"
            value={config.versionId}
            placeholder="Choose a version"
            options={versions.map((version) => ({
              value: version.id,
              label: version.label,
              description: version.source,
            }))}
            onChange={(versionId) => onConfigChange({ ...config, versionId })}
          />
          <SelectMenu
            label="Repository access"
            value={config.toolPreset}
            placeholder="Choose access"
            options={[
              { value: 'none', label: 'No tools', description: 'Prompt-only evaluation' },
              {
                value: 'read-only',
                label: 'Read-only repository',
                description: 'Read, Glob, and Grep',
              },
            ]}
            onChange={(toolPreset) =>
              onConfigChange({
                ...config,
                toolPreset: toolPreset as LaneConfig['toolPreset'],
              })
            }
          />
          <label>
            Turns
            <input
              type="number"
              min={1}
              max={20}
              value={config.maxTurns}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  maxTurns: Math.min(20, Math.max(1, Number(event.target.value))),
                })
              }
            />
          </label>
          <label>
            Timeout
            <span className="input-with-suffix">
              <input
                type="number"
                min={10}
                max={300}
                value={config.timeoutSeconds}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    timeoutSeconds: Math.min(300, Math.max(10, Number(event.target.value))),
                  })
                }
              />
              <small>sec</small>
            </span>
          </label>
        </div>
      </details>
      <div className="lane-output">
        <div>
          <strong>Assistant output</strong>
          <span>{running ? 'Streaming' : run ? 'Final' : 'Waiting'}</span>
        </div>
        <pre>{output || 'Run this configuration to see the assembled response.'}</pre>
      </div>
      <details className="trace-details">
        <summary>Trace details · {diagnosticTraces.length} events</summary>
        {diagnosticTraces.length ? (
          <ol aria-label={`${label} diagnostic trace`}>
            {diagnosticTraces.map((trace) => (
              <li key={trace.id}>
                <time dateTime={trace.timestamp}>
                  {new Date(trace.timestamp).toLocaleTimeString()}
                </time>
                <strong>{trace.kind}</strong>
                <span>{traceText(trace)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No diagnostic events yet.</p>
        )}
      </details>
    </section>
  );
}

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
  onLaunch: (input: {
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
  }) => Promise<SkillTestRun>;
  onCancel: (id: string) => Promise<void>;
  onReauthenticate: () => Promise<void>;
  onSkillChange: (id: string) => Promise<SkillPackage | undefined>;
}) {
  const [prompt, setPrompt] = useState('');
  const [projectId, setProjectId] = useState(runs[0]?.projectId ?? '');
  const [leftConfig, setLeftConfig] = useState<LaneConfig>({
    versionId: runs[0]?.versionId ?? versions[0]?.id ?? '',
    model: availableModel(runs[0]?.model, 'sonnet'),
    effort: runs[0]?.effort ?? 'high',
    toolPreset: runs[0]?.toolPreset ?? 'none',
    maxTurns: 4,
    timeoutSeconds: 60,
  });
  const [rightConfig, setRightConfig] = useState<LaneConfig>({
    versionId: runs[1]?.versionId ?? versions[1]?.id ?? versions[0]?.id ?? '',
    model: availableModel(runs[1]?.model, 'haiku'),
    effort: runs[1]?.effort ?? 'high',
    toolPreset: runs[1]?.toolPreset ?? 'none',
    maxTurns: 4,
    timeoutSeconds: 60,
  });
  const [leftRunId, setLeftRunId] = useState('');
  const [rightRunId, setRightRunId] = useState('');
  const [pausedAt, setPausedAt] = useState<Record<LaneKey, number | undefined>>({
    left: undefined,
    right: undefined,
  });

  const effectiveLeftConfig = {
    ...leftConfig,
    versionId: leftConfig.versionId || versions[0]?.id || '',
  };
  const effectiveRightConfig = {
    ...rightConfig,
    versionId: rightConfig.versionId || versions[1]?.id || versions[0]?.id || '',
  };
  const leftRun = runs.find(({ id }) => id === leftRunId) ?? runs[0];
  const rightRun = runs.find(({ id }) => id === rightRunId) ?? runs[1];
  const allLeftTraces = tracesByRun[leftRunId] ?? [];
  const allRightTraces = tracesByRun[rightRunId] ?? [];
  const leftTraces =
    pausedAt.left === undefined ? allLeftTraces : allLeftTraces.slice(0, pausedAt.left);
  const rightTraces =
    pausedAt.right === undefined ? allRightTraces : allRightTraces.slice(0, pausedAt.right);
  const canRun =
    Boolean(skill && prompt.trim()) &&
    (demoMode || (readiness.claude.available && readiness.claude.authenticated));
  const loginCompleted = readiness.authLogin?.state === 'completed';
  const authenticationFailed =
    !loginCompleted &&
    [leftRun, rightRun].some((run) => run?.output?.includes('OAuth access token has expired'));

  const launchLane = async (lane: LaneKey) => {
    const config = lane === 'left' ? effectiveLeftConfig : effectiveRightConfig;
    setPausedAt((current) => ({ ...current, [lane]: undefined }));
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
    if (lane === 'left') setLeftRunId(run.id);
    else setRightRunId(run.id);
  };

  const sharedMetadata = [
    ['Status', leftRun?.status ?? 'Not run', rightRun?.status ?? 'Not run'],
    [
      'Version',
      versions.find(({ id }) => id === effectiveLeftConfig.versionId)?.label ?? 'Unavailable',
      versions.find(({ id }) => id === effectiveRightConfig.versionId)?.label ?? 'Unavailable',
    ],
    ['Model', effectiveLeftConfig.model, effectiveRightConfig.model],
    ['Effort', effectiveLeftConfig.effort, effectiveRightConfig.effort],
    [
      'Workspace',
      projects.find(({ id }) => id === projectId)?.label ?? 'Studio sandbox',
      projects.find(({ id }) => id === projectId)?.label ?? 'Studio sandbox',
    ],
    [
      'Access',
      effectiveLeftConfig.toolPreset === 'read-only' ? 'Read-only repository' : 'No tools',
      effectiveRightConfig.toolPreset === 'read-only' ? 'Read-only repository' : 'No tools',
    ],
    ['Duration', formatDuration(leftRun?.durationMs), formatDuration(rightRun?.durationMs)],
    ['Tokens', formatTokens(leftRun), formatTokens(rightRun)],
    ['Cost', formatCost(leftRun), formatCost(rightRun)],
    [
      'Assertions',
      leftRun?.assertions.length
        ? `${leftRun.assertions.filter(({ passed }) => passed).length}/${leftRun.assertions.length} passed`
        : 'None',
      rightRun?.assertions.length
        ? `${rightRun.assertions.filter(({ passed }) => passed).length}/${rightRun.assertions.length} passed`
        : 'None',
    ],
  ];

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
                options={skills.map((item) => ({
                  value: item.id,
                  label: item.name,
                  description: `${item.scope} · ${item.relativePath}`,
                }))}
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
          <StateText
            tone={
              demoMode || (readiness.claude.available && readiness.claude.authenticated)
                ? 'success'
                : 'warning'
            }
          >
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
      <section className="shared-experiment panel" aria-labelledby="shared-input-title">
        <div className="panel-heading">
          <div>
            <h2 id="shared-input-title">Shared test input</h2>
            <span>Runs two headless Claude Code instances with the same prompt and workspace</span>
          </div>
          <button
            className="button primary"
            disabled={
              !canRun ||
              leftRun?.status === 'running' ||
              rightRun?.status === 'running' ||
              !effectiveLeftConfig.versionId ||
              !effectiveRightConfig.versionId
            }
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
            options={skills.map((item) => ({
              value: item.id,
              label: item.name,
              description: `${item.scope} · ${item.relativePath}`,
            }))}
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
          <label>
            Prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the task both configurations should handle"
            />
          </label>
        </div>
      </section>
      <div className="experiment-grid">
        <ExperimentLane
          label="Configuration A"
          config={effectiveLeftConfig}
          versions={versions}
          run={leftRun}
          traces={leftTraces}
          paused={pausedAt.left !== undefined}
          canRun={canRun}
          onConfigChange={setLeftConfig}
          onRun={() => void launchLane('left')}
          onCancel={() => leftRun && void onCancel(leftRun.id)}
          onPause={() =>
            setPausedAt((current) => ({
              ...current,
              left: current.left === undefined ? allLeftTraces.length : undefined,
            }))
          }
        />
        <ExperimentLane
          label="Configuration B"
          config={effectiveRightConfig}
          versions={versions}
          run={rightRun}
          traces={rightTraces}
          paused={pausedAt.right !== undefined}
          canRun={canRun}
          onConfigChange={setRightConfig}
          onRun={() => void launchLane('right')}
          onCancel={() => rightRun && void onCancel(rightRun.id)}
          onPause={() =>
            setPausedAt((current) => ({
              ...current,
              right: current.right === undefined ? allRightTraces.length : undefined,
            }))
          }
        />
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
