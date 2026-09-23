import { Pause, Play, Square } from 'lucide-react';

import {
  isEffortLevel,
  isToolPreset,
  isTerminalStatus,
  testRunLimits,
  type SkillTestRun,
  type SkillTestTrace,
  type SkillVersion,
} from '../../../domain/index';
import { StateText } from '../../ui/components';
import { SelectMenu } from '../../ui/SelectMenu';
import { effortOptions, modelOptions, toolPresetOptions, type LaneConfig } from './lane-options';

function assembledAssistantOutput(traces: SkillTestTrace[]): string {
  return traces
    .filter((trace): trace is Extract<SkillTestTrace, { kind: 'assistant' }> => {
      return trace.kind === 'assistant';
    })
    .map(({ text }) => text)
    .join('');
}

function traceText(trace: SkillTestTrace): string {
  switch (trace.kind) {
    case 'assistant':
      return trace.text;
    case 'warning':
      return trace.message;
    case 'tool':
      return `${trace.name}: ${trace.status}`;
    case 'process':
      return trace.state;
    case 'result':
      return trace.status;
  }
}

function toneFor(status?: SkillTestRun['status']) {
  if (status === 'passed') return 'success';
  if (status === 'failed' || status === 'timed-out') return 'danger';
  if (status === 'running' || status === 'queued') return 'accent';
  return 'neutral';
}

function clamp(value: number, limits: { min: number; max: number }): number {
  return Math.min(limits.max, Math.max(limits.min, Math.round(value) || limits.min));
}

export function ExperimentLane({
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
  const running = run !== undefined && !isTerminalStatus(run.status);

  return (
    <section className="experiment-lane panel" aria-label={`${label} configuration and result`}>
      <div className="experiment-lane-heading">
        <div>
          <span>{label}</span>
          <span role="status">
            <StateText tone={toneFor(run?.status)}>{run?.status ?? 'Not run'}</StateText>
          </span>
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
          onChange={(effort) => {
            if (isEffortLevel(effort)) onConfigChange({ ...config, effort });
          }}
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
            options={toolPresetOptions}
            onChange={(toolPreset) => {
              if (isToolPreset(toolPreset)) onConfigChange({ ...config, toolPreset });
            }}
          />
          <label>
            Turns
            <input
              type="number"
              min={testRunLimits.maxTurns.min}
              max={testRunLimits.maxTurns.max}
              value={config.maxTurns}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  maxTurns: clamp(Number(event.target.value), testRunLimits.maxTurns),
                })
              }
            />
          </label>
          <label>
            Timeout
            <span className="input-with-suffix">
              <input
                type="number"
                min={testRunLimits.timeoutSeconds.min}
                max={testRunLimits.timeoutSeconds.max}
                value={config.timeoutSeconds}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    timeoutSeconds: clamp(Number(event.target.value), testRunLimits.timeoutSeconds),
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
      {run && run.assertions.length > 0 && (
        <ul className="assertion-list" aria-label={`${label} assertions`}>
          {run.assertions.map((assertion) => (
            <li key={assertion.label} data-passed={assertion.passed}>
              <strong>{assertion.passed ? 'Pass' : 'Fail'}</strong>
              <span>{assertion.label}</span>
            </li>
          ))}
        </ul>
      )}
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
