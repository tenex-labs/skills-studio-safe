# Claude Skill Studio

Local Claude Code skill management and test application.

## Product and storage contract

- Library discovers personal `~/.claude/skills` and explicitly trusted project `.claude/skills`.
- Editor saves immutable local versions without overwriting installed skill files.
- Test Lab runs two bounded, no-tools `claude -p` configurations against shared input and compares
  their saved results.
- The filesystem is the authority for installed state.
- SQLite stores trusted roots, immutable versions, test cases, and saved final results.
- Active partial traces are ephemeral SSE data and are not persisted as results.

## Commands

```bash
npm install
npm run dev
npm run preflight
```

## Code map

- `app/domain/` — pure Skill Studio contracts
- `app/backend/catalog/` — skill discovery, validation, and safe filesystem access
- `app/backend/versions/` — SQLite migrations, versions, test cases, and results
- `app/backend/testing/` — bounded Claude subprocess and ephemeral traces
- `app/backend/api/` — loopback HTTP, SSE, origin, and mutation security
- `app/frontend/shell/` — browser shell and global styling
- `app/frontend/state/` — API client and application orchestration
- `app/frontend/features/` — Library, Editor, and the two-lane Test Lab
- `app/frontend/model/` — pure presentation projections
- `app/frontend/ui/` — reusable accessible components
- `app/entrypoints/` — browser and server startup
- `tests/` — boundary-mirrored backend and frontend tests

## Boundaries

Read `docs/architecture.md`, `docs/conventions.md`, and `docs/privacy.md` first. Keep external I/O at
catalog, storage, runner, and HTTP/SSE boundaries. Validate filesystem paths, database input, API
input, and runner events. Never infer project trust, silently merge same-name skills, enable Claude
tools during tests, persist partial traces, or log prompts, skill bodies, model output, credentials,
or environment values.

Do not add Cursor skill support, deployment, application auth, cloud services, remote telemetry, or
background agents. Changed behavior needs focused tests, `npm run preflight`, and a
final diff review that preserves existing work.
