# Documentation

## System contract

- [Architecture](architecture.md) — readiness, product areas, data flow, boundaries, and omissions
- [Conventions](conventions.md) — implementation rules for this small repository
- [Event model](event-model.md) — the normalized `MissionEvent` contract
- [Privacy](privacy.md) — allowed metadata and rejected content

## Runbooks

- [Local development](runbooks/local-development.md) — install, run, verify, and reset
- [Claude telemetry](runbooks/claude-telemetry.md) — prove safe project-local live hooks
- [Workshop demo](runbooks/workshop-demo.md) — Runs, Compare, Decisions, and fallbacks
- [Troubleshooting](runbooks/troubleshooting.md) — doctor, ports, hooks, readiness, and SSE

## Challenges

Each file in [`../challenges/`](../challenges/) is an independent, roughly 20-minute path. Choose
setup readiness, run comparison, subagent visualization, decision policy, privacy inspection,
accessibility, or a self-defined slice. No challenge requires a live Claude session; use seed
fixtures unless the challenge explicitly asks for live proof.

The root [`BRIEF.md`](../BRIEF.md) owns the desired outcome. [`PLAN.md`](../PLAN.md) records the
baseline and points to the workshop-ready technical plan. Neither file is a mutable status tracker.
