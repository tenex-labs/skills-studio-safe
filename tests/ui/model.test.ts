import { describe, expect, it } from 'vitest';
import {
  injectFacilitatorScenario,
  liveRunsFromEvents,
  missionEventSchema,
  normalizeSetupReadiness,
  projectSubagents,
  resolveDecision,
  runComparison,
  seedApprovals,
  seedEvents,
  seedRuns,
  setupFallback,
} from '../../src/model';

describe('live mission events', () => {
  it('uses the shared collector event contract and creates a safe live run', () => {
    const event = missionEventSchema.parse({
      id: 'event-1',
      timestamp: '2026-09-21T17:26:00Z',
      sessionId: 'sha256:abc12345',
      agentType: 'general-purpose',
      kind: 'session',
      action: 'start',
      status: 'started',
      repository: 'mission-demo',
    });

    expect(liveRunsFromEvents([event])).toEqual([
      expect.objectContaining({
        id: 'sha256:abc12345',
        agent: 'general-purpose',
        project: 'mission-demo',
        status: 'running',
        source: 'live',
        tokens: null,
        cost: null,
        verification: 'unavailable',
      }),
    ]);
  });
});

describe('setup readiness', () => {
  it('normalizes the safe setup booleans', () => {
    expect(
      normalizeSetupReadiness({
        collectorReady: true,
        hooks: { status: 'missing' },
        events: { acceptedCount: 0, firstEventReceived: false },
      }),
    ).toEqual({
      collector: 'ready',
      hooks: 'missing',
      firstEvent: 'waiting',
    });
  });

  it('falls back without making seed mode unavailable', () => {
    expect(normalizeSetupReadiness({ unexpected: true })).toEqual(setupFallback);
    expect(setupFallback.detail).toContain('Seed mode continues');
  });
});

describe('run projections', () => {
  it('projects parent-child agents from MissionEvent metadata', () => {
    const agents = projectSubagents(seedEvents, 'run-atlas-27');

    expect(agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'agent-atlas-root', agentType: 'lead' }),
        expect.objectContaining({
          id: 'agent-atlas-analysis',
          parentId: 'agent-atlas-root',
          agentType: 'explore',
        }),
        expect.objectContaining({
          id: 'agent-atlas-review',
          parentId: 'agent-atlas-root',
          agentType: 'review',
        }),
      ]),
    );
  });

  it('shows seeded values and marks live telemetry unavailable', () => {
    const seeded = runComparison(seedRuns[0], seedEvents);
    const liveRun = liveRunsFromEvents([
      missionEventSchema.parse({
        id: 'event-live',
        timestamp: '2026-09-21T17:26:00Z',
        sessionId: 'sha256:live',
        kind: 'session',
        action: 'start',
        status: 'started',
      }),
    ])[0];
    const live = runComparison(liveRun, []);

    expect(seeded).toMatchObject({
      events: '6',
      subagents: '2',
      tokens: '18,420',
      cost: '$3.84',
      verification: 'Pending',
    });
    expect(live).toMatchObject({
      tokens: 'Unavailable',
      cost: 'Unavailable',
      verification: 'Unavailable',
    });
  });
});

describe('simulated decision queue', () => {
  it('injects deterministic facilitator scenarios', () => {
    const decisions = injectFacilitatorScenario(seedApprovals, 'risky-shell');

    expect(decisions[0]).toMatchObject({
      id: 'scenario-risky-shell-1',
      tool: 'Shell',
      decision: 'pending',
      simulated: true,
    });
  });

  it('resolves decisions in local immutable state', () => {
    const resolved = resolveDecision(seedApprovals, 'approval-1', 'denied');

    expect(resolved).not.toBe(seedApprovals);
    expect(resolved.find(({ id }) => id === 'approval-1')?.decision).toBe('denied');
    expect(seedApprovals.find(({ id }) => id === 'approval-1')?.decision).toBe('pending');
  });
});
