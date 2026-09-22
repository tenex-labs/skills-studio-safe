# Architecture

Agent Mission Control is one local browser app, one local collector, and reversible project-scoped
Claude hooks. Deterministic seed data keeps the product and challenges usable when no live event is
available.

## Startup and readiness

```text
npm run workshop
  ├─ doctor: Node, CLI, files, ports, repository scope, hook state
  ├─ install only owned hooks in project settings
  └─ start collector + Vite UI

second terminal in this repository
  └─ authenticated `claude` session -> project hooks -> collector
```

The UI reports three independent facts:

1. **Collector ready** — this app, not an arbitrary listener, answers its local health check.
2. **Project hooks installed** — the owned entries exist in this repository's Claude settings.
3. **First event received** — the collector accepted at least one supported live event.

An open browser or SSE connection is not proof of a live agent. Until the third condition is true,
seed data remains visible and clearly labeled.

## Event data flow

```text
deterministic seed events ─────────────────────────────────────────┐
                                                                  v
Claude project hooks -> validate -> allowlist -> MissionEvent -> in-memory store -> SSE
                               reject content                            |
                                                                         v
                                              Runs / Compare / Decisions
                                                + subagent projection
```

`shared/mission-event.ts` is the only lifecycle contract shared across the collector and browser.
Raw hook objects stop at the validation boundary.

## Product areas

### Runs

Runs groups normalized events by hashed session identifier. Run detail explains lifecycle evidence,
status, failures, and parent-child subagent activity. Relationships come from `agentId` and
`parentAgentId`, never prompt or transcript content.

### Compare

Compare selects two projected runs and presents status, duration, event count, tool failures,
subagents, tokens, and cost. Seed fixtures may provide deterministic tokens and cost. Live values
that the event contract cannot prove are labeled unavailable, not zero or estimated.

### Decisions

Decisions is a local workshop queue. Seed entries and facilitator-injected scenarios exercise policy
and interface behavior. Allow, deny, and clarification outcomes update browser state only; they do
not call Claude, change settings, or grant real permissions.

## Ownership boundaries

- `scripts/doctor.mjs` diagnoses setup without printing settings content.
- `scripts/workshop.mjs` runs diagnostics, installs owned project hooks, explains the two-terminal
  workflow, and starts the app.
- `scripts/connect-claude.mjs` and `scripts/disconnect-claude.mjs` merge and remove only owned
  project entries while preserving unrelated settings.
- `server/` owns loopback HTTP input, health/readiness, runtime validation, safe normalization,
  bounded in-memory storage, and SSE.
- `src/` owns accessible navigation, readiness presentation, seed fixtures, pure run/comparison/
  subagent projections, and local simulated decision state.

The privacy boundary precedes storage, logs, SSE, and UI. See [`privacy.md`](privacy.md). Hook
failures are acknowledged or isolated quickly so the collector cannot block Claude Code.

## Failure and recovery behavior

- Collector unavailable: the browser renders seed data and readiness explains the failed check.
- Hooks missing: workshop or `npm run connect:claude` can reinstall only the owned entries.
- No first event: start an authenticated Claude CLI session from this repository.
- SSE interruption: reconnect without losing the seeded experience.
- Invalid input: reject it without logging the raw payload.
- Port conflict: doctor distinguishes this app from an unrelated listener and reports recovery.

## Deferred extension: Prometheus

Prometheus polling is not implemented and is not in the attendee critical path. A future adapter
would require an explicit aggregate allowlist, disabled content logs, privacy tests, and honest
unavailable states. It must not expand `MissionEvent` with content-bearing fields.

## Intentionally omitted

No database, authentication, cloud service, API key, deployment, Prometheus runtime, transcript
parsing, terminal scraping, multi-user aggregation, production history, or real Claude permission
control.
