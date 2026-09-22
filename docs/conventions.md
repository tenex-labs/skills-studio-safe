# Conventions

These rules keep Claude Skill Studio direct and recoverable.

## TypeScript and domain code

- Keep TypeScript strict. Validate external `unknown` values before narrowing; do not introduce
  unvalidated `any`.
- Prefer domain names such as `SkillSource`, `SkillVersion`, `TestCase`, `TestRun`, and `SavedResult`
  over generic managers, helpers, factories, or base classes.
- Give each decision one owner. For example, one pure projection decides whether a run needs
  attention.
- Separate pure normalization and projection logic from HTTP, storage, timers, and browser effects.
- Represent finite states with discriminated unions or const objects.
- Use immutable transformations and specific errors with actionable messages.
- Delete replaced paths instead of leaving compatibility wrappers without a current caller.

## Catalog and filesystem

- Filesystem `SKILL.md` content is installed authority; database rows are never a silent substitute.
- Canonicalize paths and keep reads/writes inside personal or explicitly trusted project roots.
- Model personal and project sources separately. Compute precedence; never merge same-name content.
- Rescan safely after external changes and represent malformed, missing, or conflicting skills.
- Promote with explicit scope, an immutable pre-write version, and an atomic replacement.

## SQLite

- Use migrations, foreign keys, transactions, parameterized queries, and explicit retention.
- Treat skill versions, test cases used by a run, and saved results as immutable records.
- Do not persist active trace chunks or create a saved result for a non-completed run.
- Keep database paths configurable and outside the repository.

## Runner and events

- Spawn `claude -p` directly without shell interpolation and reuse existing CLI authentication.
- Disable tools and enforce timeout, output, concurrency, and cancellation bounds.
- Normalize only known runner events. Unknown input is ignored or rejected without dumping content.
- Use SSE only for active progress. One terminal event ends a run; reconnect is not durable replay.
- Separate process status from assertion status and result save status.

## React

- Keep components focused on presentation or orchestration.
- Derive state rather than synchronizing duplicate state.
- Render loading, empty, error, permission, and success behavior deliberately.
- Start with semantic elements. Preserve keyboard operation, visible focus, meaningful labels, and
  status announcements.
- Label source scope, effective precedence, draft/installed state, active/saved state, and runner
  terminal status in user-facing text.
- Preserve semantic navigation and keyboard-complete Library, Editor, Test Lab, and Compare flows.

## Tests

- Place focused tests beside the behavior or in the matching `tests/` area.
- Assert behavior and boundaries, not component internals.
- Use deterministic time and identifiers.
- Test path escape, untrusted projects, precedence, interrupted runs, and persistence boundaries as
  first-class behavior.
- Use snapshots only when the complete rendered structure is the behavior under test.

Do not add an abstraction, dependency, or architectural layer for an imagined future variant.
