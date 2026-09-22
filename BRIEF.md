# Agent Mission Control brief

## Outcome

Create a polished local workshop console that helps a mixed technical and business audience
understand coding-agent runs, compare outcomes, see subagent relationships, practice simulated
human decisions, and inspect safe telemetry boundaries.

## Users

- Attendees exploring and extending a small React/TypeScript application
- Presenters demonstrating repository context, agent workflows, and optional live telemetry

## Approved experience

- One workshop command prepares project hooks and starts the local app.
- Deterministic seed data supports Runs, Compare, Decisions, and every challenge as a fallback.
- Optional local Claude HTTP hooks add lifecycle events through a local collector and SSE.
- Setup readiness distinguishes collector, project hooks, and first live event.
- Parent-child subagent activity comes only from the safe event contract.
- Facilitator-injected decisions and outcomes are visibly local simulations.

## Success conditions

- A new attendee can install and start the app with the two commands in `README.md`.
- Doctor gives actionable setup evidence before the workshop starts.
- The app remains useful when live telemetry or internet access is unavailable.
- Seed and live inputs produce the same normalized `MissionEvent` shape.
- Sensitive content is rejected before storage.
- Collector failure never blocks Claude Code.
- Each challenge is feasible in roughly 20 implementation minutes after exploration.

## Non-goals

No database, authentication, cloud service, API keys, deployment, transcript parsing, multi-user
aggregation, durable production history, real permission control, or attendee-critical Prometheus
integration.
