import { Pause, Play, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  SkillPackage,
  SkillTestCase,
  SkillTestRun,
  SkillTestTrace,
  SkillVersion,
  StudioReadiness,
} from '../../../domain/index';
import { formatCost, formatDuration, formatTokens } from '../../model/skill-view-model';
import { EmptyState, PageHeading, StatusPill } from '../../ui/components';

function traceText(trace: SkillTestTrace): string {
  if (trace.kind === 'assistant') return trace.text;
  if (trace.kind === 'warning') return trace.message;
  if (trace.kind === 'tool') return `${trace.name}: ${trace.status}`;
  if (trace.kind === 'process') return `process: ${trace.state}`;
  return `result: ${trace.status}`;
}

export function TestLabView({
  skill,
  versions,
  testCases,
  runs,
  traces,
  readiness,
  demoMode,
  onLaunch,
  onCancel,
}: {
  skill?: SkillPackage;
  versions: SkillVersion[];
  testCases: SkillTestCase[];
  runs: SkillTestRun[];
  traces: SkillTestTrace[];
  readiness: StudioReadiness;
  demoMode: boolean;
  onLaunch: (input: {
    versionId: string;
    testCaseId?: string;
    prompt: string;
    model: string;
    settings: { maxTurns: number; timeoutSeconds: number };
  }) => Promise<SkillTestRun>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [versionId, setVersionId] = useState(versions[0]?.id ?? '');
  const [testCaseId, setTestCaseId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('sonnet');
  const [maxTurns, setMaxTurns] = useState(4);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [paused, setPaused] = useState(false);
  const [pausedCount, setPausedCount] = useState(0);
  const [activeRunId, setActiveRunId] = useState('');

  const activeRun = runs.find(({ id }) => id === activeRunId) ?? runs[0];
  const visibleTraces = paused ? traces.slice(0, pausedCount) : traces;
  const canRun =
    Boolean(skill && versionId && prompt.trim()) &&
    (demoMode || (readiness.claude.available && readiness.claude.authenticated));
  const terminal = activeRun && !['queued', 'running'].includes(activeRun.status);
  const chosenCase = useMemo(
    () => testCases.find((testCase) => testCase.id === testCaseId),
    [testCaseId, testCases],
  );

  if (!skill) {
    return (
      <>
        <PageHeading title="Test lab" description="Run a skill version against a local prompt." />
        <EmptyState title="Select a skill">
          Open a skill from the library before testing.
        </EmptyState>
      </>
    );
  }

  const selectCase = (id: string) => {
    setTestCaseId(id);
    const testCase = testCases.find((item) => item.id === id);
    if (testCase) setPrompt(testCase.prompt);
  };

  return (
    <>
      <PageHeading
        title="Test lab"
        description={`Exercise ${skill.name} locally with bounded settings and a live trace.`}
        action={
          <StatusPill
            tone={
              demoMode || (readiness.claude.available && readiness.claude.authenticated)
                ? 'success'
                : 'warning'
            }
          >
            {demoMode
              ? 'Demo runner'
              : readiness.claude.available && readiness.claude.authenticated
                ? `Claude account found${readiness.claude.version ? ` · ${readiness.claude.version}` : ''}`
                : 'Claude sign-in required'}
          </StatusPill>
        }
      />
      <div className="test-layout">
        <section className="panel test-form" aria-labelledby="test-config-title">
          <div className="panel-heading">
            <h2 id="test-config-title">Test configuration</h2>
            <span>Local content</span>
          </div>
          <div className="form-stack">
            <label>
              Skill version
              <select value={versionId} onChange={(event) => setVersionId(event.target.value)}>
                <option value="">Choose a version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Saved test case
              <select value={testCaseId} onChange={(event) => selectCase(event.target.value)}>
                <option value="">Ad hoc prompt</option>
                {testCases.map((testCase) => (
                  <option key={testCase.id} value={testCase.id}>
                    {testCase.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prompt
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the task the skill should handle"
              />
            </label>
            {chosenCase && (
              <p className="expectations">
                Expected: {chosenCase.expectedContains.join(', ') || 'No required text'} · Excludes:{' '}
                {chosenCase.expectedExcludes.join(', ') || 'None'}
              </p>
            )}
            <div className="form-grid three">
              <label>
                Model
                <select value={model} onChange={(event) => setModel(event.target.value)}>
                  <option value="sonnet">Claude Sonnet</option>
                  <option value="haiku">Claude Haiku</option>
                  <option value="opus">Claude Opus</option>
                </select>
              </label>
              <label>
                Max turns
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={maxTurns}
                  onChange={(event) =>
                    setMaxTurns(Math.min(12, Math.max(1, Number(event.target.value))))
                  }
                />
              </label>
              <label>
                Timeout (seconds)
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={timeoutSeconds}
                  onChange={(event) =>
                    setTimeoutSeconds(Math.min(300, Math.max(10, Number(event.target.value))))
                  }
                />
              </label>
            </div>
            <p className="privacy-note">
              Normal skill tests run without tools. Prompt and output stay local; partial traces are
              ephemeral.
            </p>
            <button
              className="button primary"
              disabled={!canRun || activeRun?.status === 'running'}
              onClick={() =>
                void onLaunch({
                  versionId,
                  testCaseId: testCaseId || undefined,
                  prompt,
                  model,
                  settings: { maxTurns, timeoutSeconds },
                }).then((run) => setActiveRunId(run.id))
              }
            >
              <Play size={17} aria-hidden="true" />
              Launch test
            </button>
          </div>
        </section>
        <section className="panel trace-panel" aria-labelledby="trace-title">
          <div className="panel-heading">
            <div>
              <h2 id="trace-title">Live trace</h2>
              <span>{paused ? 'Paused display' : 'Following events'}</span>
            </div>
            <div className="button-row">
              <button
                className="icon-button"
                aria-label={paused ? 'Resume live trace' : 'Pause live trace'}
                aria-pressed={paused}
                onClick={() => {
                  setPaused((value) => {
                    if (!value) setPausedCount(traces.length);
                    return !value;
                  });
                }}
              >
                {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </button>
              <button
                className="icon-button danger"
                aria-label="Cancel test"
                disabled={!activeRun || activeRun.status !== 'running'}
                onClick={() => activeRun && void onCancel(activeRun.id)}
              >
                <Square aria-hidden="true" />
              </button>
            </div>
          </div>
          <ol
            className="trace-list"
            aria-live={paused ? 'off' : 'polite'}
            aria-label="Test event trace"
          >
            {visibleTraces.map((trace) => (
              <li key={trace.id}>
                <time dateTime={trace.timestamp}>
                  {new Date(trace.timestamp).toLocaleTimeString()}
                </time>
                <strong>{trace.kind}</strong>
                <span>{traceText(trace)}</span>
              </li>
            ))}
          </ol>
          {visibleTraces.length === 0 && (
            <p className="panel-copy">Launch a test to see local process events.</p>
          )}
        </section>
      </div>
      {activeRun && (
        <section className="panel results-panel" aria-labelledby="result-title">
          <div className="panel-heading">
            <h2 id="result-title">Test result</h2>
            <StatusPill
              tone={
                activeRun.status === 'passed'
                  ? 'success'
                  : activeRun.status === 'failed'
                    ? 'danger'
                    : 'accent'
              }
            >
              {activeRun.status}
            </StatusPill>
          </div>
          <div className="result-grid">
            <div>
              <h3>Final output</h3>
              <pre>
                {activeRun.output || (terminal ? 'No output returned.' : 'Test is running…')}
              </pre>
            </div>
            <div>
              <h3>Assertions</h3>
              {activeRun.assertions.length ? (
                <ul>
                  {activeRun.assertions.map((assertion) => (
                    <li key={assertion.label} data-passed={assertion.passed}>
                      {assertion.passed ? 'Pass' : 'Fail'} · {assertion.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {terminal ? 'No assertions configured.' : 'Unavailable until the run finishes.'}
                </p>
              )}
            </div>
            <dl className="metric-list">
              <div>
                <dt>Model</dt>
                <dd>{activeRun.model || 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(activeRun.durationMs)}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{formatTokens(activeRun)}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{formatCost(activeRun)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}
    </>
  );
}
