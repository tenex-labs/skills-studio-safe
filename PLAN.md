# Agent Mission Control implementation plan

This plan records the original technical baseline and does not track mutable work status.
[`PLAN-workshop-ready.md`](PLAN-workshop-ready.md) supersedes its setup and product-shape decisions.

## Decisions

- Use React, Vite, strict TypeScript, Vitest, and Testing Library.
- Keep seed data as the reliable fallback and live telemetry as an optional local capability.
- Run one small local Node HTTP collector with an in-memory store and SSE updates.
- Normalize seed and hook inputs into one `MissionEvent` model.
- Use an allowlist before storage; never capture content and attempt redaction afterward.
- Use project-scoped Claude Code HTTP hooks for lifecycle events. Do not read transcripts.
- Keep approvals simulated. Add no database, auth, cloud service, API keys, or deployment.
- Fail open: telemetry unavailability must not delay or block Claude Code.
- Use Runs, Compare, and Decisions as the product areas, with explicit setup readiness.
- Keep Prometheus deferred; it is not implemented or part of attendee setup.

## Implementation slices

1. **Repository context** — root guidance, architecture, conventions, privacy contract, runbooks,
   scoped rules, workshop challenges, and feature-mockup skill.
2. **Seeded product** — normalized event model, deterministic fixtures, Runs, Compare, Decisions,
   run detail, setup readiness, and accessible state handling.
3. **Safe lifecycle feed** — runtime validation, allowlist sanitizer, in-memory store, HTTP hook
   endpoint, SSE stream, and non-blocking connect/disconnect scripts.
4. **Workshop setup** — doctor, reversible project-hook setup, one-command launcher, and seed
   fallback.
5. **Verification and rehearsal** — privacy tests, focused UI tests, full preflight/test/build,
   collector-downtime proof, workshop challenge timing, and demo fallback check.

## Verification

```bash
npm install
npm run doctor
npm run preflight
npm test
npm run build
```

Also verify seed mode without telemetry, reversible settings changes, fast hook acknowledgement,
SSE reconnect behavior, absence of sensitive stored fields, and immediate fallback from live mode.

## Risks and controls

- Hook schemas can drift: keep validation and adapters narrow.
- Telemetry can expose content if misconfigured: allowlist lifecycle metadata before storage.
- Ports can conflict: document alternatives and retain seed mode.
- Settings changes can cause damage: merge project settings, preserve a local backup, and provide an
  idempotent disconnect.
- Optional demo tools can fail: keep HTML, seed-data, and static evidence fallbacks.
