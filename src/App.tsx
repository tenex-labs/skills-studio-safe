import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  GitCompareArrows,
  Inbox,
  ListTree,
  MessageSquareMore,
  Play,
  SquareTerminal,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  eventDetail,
  eventTitle,
  facilitatorScenarios,
  formatTime,
  injectFacilitatorScenario,
  liveRunsFromEvents,
  projectSubagents,
  resolveDecision,
  runComparison,
  seedApprovals,
  seedRuns,
  type AgentRun,
  type Approval,
  type ApprovalDecision,
  type FacilitatorScenarioId,
  type MissionEvent,
  type RunStatus,
  type SetupReadiness,
} from './model';
import { useMissionEvents, type DataMode } from './useMissionEvents';
import { useSetupReadiness } from './useSetupReadiness';

type Screen = 'runs' | 'compare' | 'decisions' | 'detail';

const statusLabel: Record<RunStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  failed: 'Failed',
  complete: 'Complete',
};

const navItems: Array<{
  screen: Exclude<Screen, 'detail'>;
  label: string;
  icon: LucideIcon;
}> = [
  { screen: 'runs', label: 'Runs', icon: ListTree },
  { screen: 'compare', label: 'Compare', icon: GitCompareArrows },
  { screen: 'decisions', label: 'Decisions', icon: Inbox },
];

function Status({ status }: { status: RunStatus }) {
  return (
    <span className="status" data-status={status}>
      <span className="status-mark" aria-hidden="true" />
      {statusLabel[status]}
    </span>
  );
}

function ModeBadge({ mode }: { mode: DataMode }) {
  return (
    <span className="mode-badge" data-mode={mode}>
      {mode === 'live' ? 'Live events received' : 'Seed data'}
    </span>
  );
}

function SetupStrip({ readiness }: { readiness: SetupReadiness }) {
  const items = [
    {
      label: 'Collector',
      value: readiness.collector === 'ready' ? 'Ready' : 'Unavailable',
      state: readiness.collector === 'ready' ? 'ok' : 'warn',
    },
    {
      label: 'Hooks',
      value:
        readiness.hooks === 'installed'
          ? 'Installed'
          : readiness.hooks === 'missing'
            ? 'Missing'
            : 'Unknown',
      state: readiness.hooks === 'installed' ? 'ok' : 'warn',
    },
    {
      label: 'Live event',
      value: readiness.firstEvent === 'received' ? 'Received' : 'Waiting',
      state: readiness.firstEvent === 'received' ? 'ok' : 'neutral',
    },
  ];

  return (
    <section className="setup-strip" aria-label="Setup readiness">
      <strong>Setup</strong>
      <div className="setup-items">
        {items.map((item) => (
          <span className="setup-item" data-state={item.state} key={item.label}>
            <span aria-hidden="true" />
            {item.label}: {item.value}
          </span>
        ))}
      </div>
      <p>
        {readiness.detail ??
          (readiness.hooks === 'missing'
            ? 'Run npm run workshop to install project hooks.'
            : readiness.firstEvent === 'waiting'
              ? 'Start a Claude session in this repository; seed mode remains available.'
              : 'Local setup is receiving safe lifecycle metadata.')}
      </p>
    </section>
  );
}

function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function RunRow({ run, onSelect }: { run: AgentRun; onSelect: (run: AgentRun) => void }) {
  return (
    <button className="run-row" onClick={() => onSelect(run)} aria-label={`Inspect ${run.task}`}>
      <span className="run-identity">
        <strong>{run.task}</strong>
        <small>
          {run.agent} · {run.project} · {run.source}
        </small>
      </span>
      <Status status={run.status} />
      <span>{run.progress}%</span>
      <time dateTime={run.updatedAt}>{formatTime(run.updatedAt)}</time>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

function Runs({ runs, onSelect }: { runs: AgentRun[]; onSelect: (run: AgentRun) => void }) {
  const [attentionOnly, setAttentionOnly] = useState(false);
  const visibleRuns = attentionOnly ? runs.filter((run) => run.needsAttention) : runs;

  return (
    <>
      <PageHeading
        title="Runs"
        description="Seeded examples and safe lifecycle events from local Claude sessions."
        action={
          <button
            className="button secondary"
            aria-pressed={attentionOnly}
            onClick={() => setAttentionOnly((current) => !current)}
          >
            <AlertTriangle size={17} />
            Needs attention
          </button>
        }
      />
      <section className="panel" aria-label="Run list">
        <div className="run-columns" aria-hidden="true">
          <span>Run</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Updated</span>
          <span />
        </div>
        {visibleRuns.map((run) => (
          <RunRow key={run.id} run={run} onSelect={onSelect} />
        ))}
        {visibleRuns.length === 0 && <p className="empty-state">No runs match this filter.</p>}
      </section>
    </>
  );
}

function VerificationSummary({ run }: { run: AgentRun }) {
  const descriptions = {
    passed: 'Seeded verification completed successfully.',
    failed: 'Seeded verification contains a failure that needs review.',
    pending: 'Seeded verification has not completed.',
    unavailable: 'Verification telemetry is not available for this live run.',
  };
  return (
    <section className="summary-block" aria-labelledby="verification-title">
      <div className="section-heading">
        <h2 id="verification-title">Verification</h2>
        <span className="label" data-state={run.verification}>
          {run.verification}
        </span>
      </div>
      <p>{descriptions[run.verification]}</p>
    </section>
  );
}

function SubagentView({ events, runId }: { events: MissionEvent[]; runId: string }) {
  const agents = projectSubagents(events, runId);
  const roots = agents.filter(({ parentId }) => !parentId);
  const children = agents.filter(({ parentId }) => parentId);

  return (
    <section className="summary-block" aria-labelledby="subagent-title">
      <div className="section-heading">
        <h2 id="subagent-title">Agent activity</h2>
        <span className="label">{children.length} subagents</span>
      </div>
      {agents.length === 0 ? (
        <p>No agent relationship metadata is available for this run.</p>
      ) : (
        <ul className="agent-tree">
          {roots.map((root) => (
            <li key={root.id}>
              <strong>{root.agentType}</strong>
              <small>{root.eventCount} lifecycle events</small>
              <ul>
                {children
                  .filter(({ parentId }) => parentId === root.id)
                  .map((child) => (
                    <li key={child.id}>
                      <span>{child.agentType}</span>
                      <small>
                        {child.status} · {child.eventCount} events
                      </small>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
          {roots.length === 0 &&
            children.map((child) => (
              <li key={child.id}>
                <strong>{child.agentType}</strong>
                <small>Parent metadata only · {child.status}</small>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function RunDetail({
  run,
  events,
  onBack,
}: {
  run: AgentRun;
  events: MissionEvent[];
  onBack: () => void;
}) {
  const runEvents = events
    .filter((event) => event.sessionId === run.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const comparison = runComparison(run, events);

  return (
    <>
      <button className="button secondary back-button" onClick={onBack}>
        <ArrowLeft size={17} /> Runs
      </button>
      <PageHeading
        title={run.task}
        description={`${run.agent} · ${run.project} · ${run.source} data`}
        action={<Status status={run.status} />}
      />
      <div className="detail-layout">
        <section className="panel timeline-panel" aria-labelledby="timeline-title">
          <div className="panel-heading">
            <h2 id="timeline-title">Lifecycle evidence</h2>
            <span className="label">{runEvents.length} events</span>
          </div>
          {runEvents.length > 0 ? (
            <ol className="timeline">
              {runEvents.map((event) => (
                <li key={event.id}>
                  <CircleDot size={16} aria-hidden="true" />
                  <div>
                    <strong>{eventTitle(event)}</strong>
                    <time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time>
                    <p>{eventDetail(event)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">No lifecycle evidence is available for this seeded run.</p>
          )}
        </section>
        <aside className="detail-aside">
          <section className="summary-block">
            <h2>Run summary</h2>
            <dl className="facts">
              <div>
                <dt>Elapsed</dt>
                <dd>{comparison.duration}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{comparison.tokens}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{comparison.cost}</dd>
              </div>
              <div>
                <dt>Metrics</dt>
                <dd>{run.source === 'live' ? 'Live / partial' : 'Fictional seed'}</dd>
              </div>
            </dl>
          </section>
          <VerificationSummary run={run} />
          <SubagentView events={events} runId={run.id} />
        </aside>
      </div>
    </>
  );
}

const comparisonRows: Array<{ key: keyof ReturnType<typeof runComparison>; label: string }> = [
  { key: 'status', label: 'Status' },
  { key: 'duration', label: 'Elapsed duration' },
  { key: 'events', label: 'Event count' },
  { key: 'failedTools', label: 'Failed tools' },
  { key: 'subagents', label: 'Subagent count' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'cost', label: 'Cost' },
  { key: 'verification', label: 'Verification' },
];

function Compare({ runs, events }: { runs: AgentRun[]; events: MissionEvent[] }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const left = runs.find(({ id }) => id === leftId);
  const right = runs.find(({ id }) => id === rightId);
  const leftValues = left ? runComparison(left, events) : undefined;
  const rightValues = right ? runComparison(right, events) : undefined;

  return (
    <>
      <PageHeading
        title="Compare"
        description="Select two runs. Unavailable live telemetry is shown explicitly."
      />
      <section className="compare-selectors" aria-label="Run selectors">
        <label>
          First run
          <select value={leftId} onChange={(event) => setLeftId(event.target.value)}>
            <option value="">Select a run</option>
            {runs.map((run) => (
              <option value={run.id} key={run.id} disabled={run.id === rightId}>
                {run.task}
              </option>
            ))}
          </select>
        </label>
        <label>
          Second run
          <select value={rightId} onChange={(event) => setRightId(event.target.value)}>
            <option value="">Select a run</option>
            {runs.map((run) => (
              <option value={run.id} key={run.id} disabled={run.id === leftId}>
                {run.task}
              </option>
            ))}
          </select>
        </label>
      </section>
      {!left && !right && (
        <p className="empty-state standalone">Select two runs to compare their evidence.</p>
      )}
      {(left || right) && !(left && right) && (
        <p className="empty-state standalone">Select one more run to complete the comparison.</p>
      )}
      {left && right && leftValues && rightValues && (
        <section className="panel comparison" aria-label="Run comparison">
          <div className="comparison-header">
            <span>Metric</span>
            <strong>{left.task}</strong>
            <strong>{right.task}</strong>
          </div>
          {comparisonRows.map(({ key, label }) => (
            <div className="comparison-row" key={key}>
              <span>{label}</span>
              <strong>{leftValues[key]}</strong>
              <strong>{rightValues[key]}</strong>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function DecisionCard({
  decision,
  run,
  onDecision,
}: {
  decision: Approval;
  run?: AgentRun;
  onDecision: (id: string, value: ApprovalDecision) => void;
}) {
  return (
    <article className="decision-card">
      <div className="decision-meta">
        <span className="label">
          <SquareTerminal size={14} /> {decision.tool}
        </span>
        <span className="label" data-risk={decision.risk}>
          {decision.risk} risk
        </span>
      </div>
      <h2>{decision.request}</h2>
      <p>{decision.rationale}</p>
      <small>{run?.task ?? 'Workshop scenario'} · Simulation only</small>
      {decision.decision === 'pending' ? (
        <div className="decision-actions" aria-label={`Resolve ${decision.request}`}>
          <button className="button primary" onClick={() => onDecision(decision.id, 'allowed')}>
            <Check size={17} /> Allow locally
          </button>
          <button className="button secondary" onClick={() => onDecision(decision.id, 'clarify')}>
            <MessageSquareMore size={17} /> Clarify
          </button>
          <button
            className="button secondary danger"
            onClick={() => onDecision(decision.id, 'denied')}
          >
            <X size={17} /> Deny locally
          </button>
        </div>
      ) : (
        <p className="decision-result" role="status">
          Marked {decision.decision} locally. No external action was taken.
        </p>
      )}
    </article>
  );
}

function Decisions({
  decisions,
  runs,
  onDecision,
  onInject,
}: {
  decisions: Approval[];
  runs: AgentRun[];
  onDecision: (id: string, value: ApprovalDecision) => void;
  onInject: (id: FacilitatorScenarioId) => void;
}) {
  return (
    <>
      <PageHeading
        title="Decisions"
        description="A simulated human queue. Resolutions update this browser only."
      />
      <section className="facilitator panel" aria-labelledby="facilitator-title">
        <div className="panel-heading">
          <div>
            <h2 id="facilitator-title">Facilitator scenarios</h2>
            <p>Inject deterministic workshop situations into the local queue.</p>
          </div>
          <span className="label">Simulation</span>
        </div>
        <div className="scenario-grid">
          {facilitatorScenarios.map((scenario) => (
            <button
              className="scenario-button"
              key={scenario.id}
              onClick={() => onInject(scenario.id)}
            >
              <Play size={16} aria-hidden="true" />
              <span>
                <strong>{scenario.label}</strong>
                <small>{scenario.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="decision-list" aria-label="Human decision queue">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            run={runs.find(({ id }) => id === decision.runId)}
            onDecision={onDecision}
          />
        ))}
      </section>
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('runs');
  const [selectedRunId, setSelectedRunId] = useState(seedRuns[0].id);
  const [decisions, setDecisions] = useState(seedApprovals);
  const { events, mode } = useMissionEvents();
  const readiness = useSetupReadiness();
  const runs = useMemo(() => [...liveRunsFromEvents(events), ...seedRuns], [events]);
  const selectedRun = runs.find(({ id }) => id === selectedRunId) ?? runs[0];

  const selectRun = (run: AgentRun) => {
    setSelectedRunId(run.id);
    setScreen('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="product-name">
          <SquareTerminal size={20} aria-hidden="true" />
          <strong>Agent Mission Control</strong>
        </div>
        <ModeBadge mode={mode} />
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navItems.map(({ screen: itemScreen, label, icon: Icon }) => (
          <button
            className={
              screen === itemScreen || (screen === 'detail' && itemScreen === 'runs')
                ? 'active'
                : ''
            }
            key={itemScreen}
            onClick={() => setScreen(itemScreen)}
          >
            <Icon size={17} />
            {label}
            {itemScreen === 'decisions' && (
              <span>{decisions.filter(({ decision }) => decision === 'pending').length}</span>
            )}
          </button>
        ))}
      </nav>
      <SetupStrip readiness={readiness} />
      <main>
        {screen === 'runs' && <Runs runs={runs} onSelect={selectRun} />}
        {screen === 'compare' && <Compare runs={runs} events={events} />}
        {screen === 'detail' && (
          <RunDetail run={selectedRun} events={events} onBack={() => setScreen('runs')} />
        )}
        {screen === 'decisions' && (
          <Decisions
            decisions={decisions}
            runs={runs}
            onDecision={(id, value) =>
              setDecisions((current) => resolveDecision(current, id, value))
            }
            onInject={(id) => setDecisions((current) => injectFacilitatorScenario(current, id))}
          />
        )}
      </main>
    </div>
  );
}
