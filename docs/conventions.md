# Conventions

These rules keep a workshop-sized repository direct and understandable.

## TypeScript and domain code

- Keep TypeScript strict. Validate external `unknown` values before narrowing; do not introduce
  unvalidated `any`.
- Prefer domain names such as `MissionEvent`, `RunSummary`, and `AttentionReason` over generic
  managers, helpers, factories, or base classes.
- Give each decision one owner. For example, one pure projection decides whether a run needs
  attention.
- Separate pure normalization and projection logic from HTTP, storage, timers, and browser effects.
- Represent finite states with discriminated unions or const objects.
- Use immutable transformations and specific errors with actionable messages.
- Delete replaced paths instead of leaving compatibility wrappers without a current caller.

## React

- Keep components focused on presentation or orchestration.
- Derive state rather than synchronizing duplicate state.
- Render loading, empty, error, permission, and success behavior deliberately.
- Start with semantic elements. Preserve keyboard operation, visible focus, meaningful labels, and
  status announcements.
- Label seed, live, and simulated behavior in user-facing text.

## Telemetry

- Use one normalized event model.
- Validate first, then construct a new safe event from the allowlist.
- Keep raw payloads out of logs, errors, fixtures, storage, and SSE.
- Make network and settings effects explicit, bounded, and recoverable.
- Treat collector availability as optional and preserve seed fallback.
- Keep setup readiness separate from lifecycle events and simulated decisions.
- Label unavailable live values honestly; do not derive tokens or cost from incomplete events.

## Tests

- Place focused tests beside the behavior or in the matching `tests/` area.
- Assert behavior and boundaries, not component internals.
- Use deterministic time and identifiers.
- Test privacy rejection and degraded operation as first-class behavior.
- Use snapshots only when the complete rendered structure is the behavior under test.

Do not add an abstraction, dependency, or architectural layer for an imagined future variant.
