# Workshop demo

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- Dependencies installed and `npm run doctor` reviewed
- Seed fallback checked in the presentation browser
- Claude CLI installed and authenticated only if live proof is planned

## Start

```bash
npm run workshop
```

Open the printed URL. Confirm collector and project-hook readiness. First-event readiness may still
say waiting.

## Demo flow

1. **Readiness:** explain collector, project hooks, and first-event evidence. Waiting is honest until
   a supported live event is accepted.
2. **Runs:** open seed and live run detail. Show lifecycle evidence, failure state, and subagent
   relationships without content.
3. **Compare:** select two runs. Contrast status, duration, events, tool failures, and subagents.
   Point out fictional seed usage values and unavailable live tokens/cost.
4. **Decisions:** inject a facilitator scenario, apply a simulated outcome, and state that it has no
   effect on Claude permissions.
5. **Extension:** assign one independent challenge from [`../../challenges/`](../../challenges/).
6. **Optional live proof:** in a second terminal in this repository, run `claude` and complete one
   small interaction. Authentication and a real CLI session are required.

## Expected evidence

- Runs, Compare, Decisions, and every challenge have a seed-data path.
- Setup readiness tells attendees the next action.
- Subagent projection uses safe parent-child identifiers.
- Facilitator scenarios and outcomes are visibly simulated and local.
- Live mode, if demonstrated, shows normalized metadata and no sensitive content.
- Stopping the collector leaves Claude Code responsive.

## Recovery

- Doctor failure: follow its first actionable recovery and rerun it once.
- Port conflict: stop the conflicting process or use seed fallback; do not call it this app.
- Claude unavailable or unauthenticated: skip live proof and use seed runs.
- Hooks missing: run `npm run connect:claude`, then start a new Claude session here.
- Collector stops: keep teaching with seed data.

## Cleanup

```bash
npm run disconnect:claude
```

Exit the Claude session and stop the workshop process with `Ctrl-C`. There is no deployment,
database, or Prometheus process to clean up.
