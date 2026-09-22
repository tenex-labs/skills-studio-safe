# Agent Mission Control

Local coding-agent workshop app. Seed data is the reliable fallback; project-scoped Claude hooks can
add safe live lifecycle metadata. Prometheus is not implemented.

## Code map

- `src/` — React Runs, Compare, Decisions, readiness, projections, and seed data
- `server/` — local hook collector, sanitizer, readiness, in-memory store, and SSE
- `shared/mission-event.ts` — the only browser-facing lifecycle event contract
- `scripts/` — doctor, workshop launcher, preflight, and reversible project-hook setup
- `tests/` — behavior and boundary verification
- `docs/` — architecture, conventions, privacy contract, and runbooks
- `challenges/` — independent, roughly 20-minute workshop paths

## Commands

```bash
npm install
npm run doctor
npm run workshop
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run preflight
npm run connect:claude
npm run disconnect:claude
```

## Boundaries

- Node `^20.19.0 || >=22.12.0`; React, Vite, strict TypeScript, one browser app, and one
  small local Node collector.
- Keep one normalized `MissionEvent` model across seed and hook inputs.
- No database, auth, cloud service, API key, deployment infrastructure, or real permission control.
- Runs, Compare, and Decisions are the durable product areas.
- Facilitator scenarios and all Decisions actions are simulated local UI state.
- Reject prompts, messages, code, diffs, tool arguments, commands, raw paths, environment variables,
  secrets, and transcripts before storage.
- Project hooks apply only to Claude sessions started from this repository. Preserve unrelated
  project settings and never modify user-level settings.
- Collector failures must not delay or block Claude Code; seed data remains available.
- Do not read Claude transcript files.
- Prometheus is deferred. Do not add it to attendee setup or imply live tokens or cost exist.

Read `docs/architecture.md` before structural changes and `docs/conventions.md` before implementation.
Use `docs/runbooks/local-development.md` and `docs/runbooks/claude-telemetry.md` for setup. Real-agent
proof requires an installed, authenticated Claude CLI session in this repository.

Changed behavior requires focused verification and a final diff review.
