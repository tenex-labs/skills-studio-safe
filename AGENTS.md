# Agent guidance

Agent Mission Control is a small workshop repository, not a production control plane.

Before changing code:

1. Read `CLAUDE.md`.
2. Read `docs/architecture.md` for boundaries and `docs/conventions.md` for implementation rules.
3. Read `docs/privacy.md` before touching telemetry, collector, settings, or event code.

Keep changes narrow and complete. Preserve seed mode as the reliable fallback, use the shared
`MissionEvent` model, validate external input, and keep I/O at explicit boundaries. Never collect
content-bearing data or make Claude depend on the collector. Keep the product organized around
Runs, Compare, and Decisions; readiness must distinguish collector, project hooks, and first event.

Use Node `^20.19.0 || >=22.12.0` and the exact npm commands in `CLAUDE.md`. `npm run workshop` is the
attendee entry point; `npm run doctor` is the diagnostic entry point. Run focused tests for changed
behavior, then `npm run preflight` when the relevant scripts are available. Review the final diff
for machine-specific data, settings backups, credentials, and privacy regressions.

Do not add deployment, a database, authentication, cloud services, real approval controls, or
transcript parsing. Do not overwrite Claude settings; use the reversible connect and disconnect
scripts. Hooks are project-local to sessions started in this repository. Facilitator scenarios and
decision outcomes are local simulations. Prometheus is deferred and is not an attendee dependency.
