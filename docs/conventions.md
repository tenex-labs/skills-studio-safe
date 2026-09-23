# Conventions

These are the rules this codebase follows. `.claude/rules/` repeats the relevant ones for each
folder so Claude Code sees them while editing there; this file is the source.

## TypeScript

- Strict mode everywhere, including tests. Treat external input as `unknown` and narrow it with a
  check, not a cast.
- Put a type or rule in `app/domain/` when both the backend and the frontend need it. Limits,
  effort levels, launch input, frontmatter parsing, and assertion evaluation live there so each has
  one definition.
- Keep pure logic separate from I/O. The stream parser, assertions, validator, and view-model
  helpers take values and return values; the runner, catalog, storage, and server do the I/O.
- Model finite states as string-literal unions (`SkillTestStatus`, `SkillTestTrace['kind']`) and
  switch over them exhaustively.
- Throw `StudioValidationError`, `StudioNotFoundError`, or `RevisionConflictError` from
  `app/backend/errors.ts` for anything a user can cause. The routes map them to 400, 404, and 409.
- Delete code when its last caller goes away.

## Backend

- **Catalog:** installed files are the source of truth. Canonicalize paths and stay inside
  personal or trusted roots. Compute precedence; never merge same-name skills.
- **Storage:** add a new migration for every schema change and never edit one that has shipped.
  Use parameterized queries. JSON columns are read defensively.
- **Runner:** spawn `claude -p` directly with separate arguments. Keep the no-tools default and
  the read-only preset as the only tool options. Every run ends with exactly one `result` trace.
- **API:** add an endpoint as one entry in the route table in `routes.ts`. Validate each body
  field with the helpers there. Transport and security concerns stay in `server.ts`.

## Frontend

- `useStudio` owns state and talks to a `StudioApi`. Views get data and callbacks through props
  and never fetch.
- New API methods go on the `StudioApi` interface and in both clients (`api.ts` and
  `demo-api.ts`).
- Derive display text with pure helpers in `model/skill-view-model.ts`.
- Use semantic elements first, label every control, keep focus visible, and announce
  asynchronous status changes with `role="status"` or `role="alert"`.
- Label scope, precedence, draft versus installed, and run status in words, not color alone.
- All styles live in `shell/styles.css`, using the custom properties defined at its top.

## Tests

- `tests/` mirrors `app/`: `app/backend/testing/skill-runner.ts` is tested in
  `tests/backend/testing/skill-runner.test.ts`.
- Assert behavior a user or caller can observe, not component internals.
- Use fixed timestamps and IDs. Fake the Claude process; real `claude -p` runs are manual only.
- Cover the boundaries: path escapes, untrusted projects, precedence, runner limits, cancellation,
  every terminal status, and what does or does not get saved.

Do not add an abstraction, dependency, or layer for a variant that does not exist yet.
