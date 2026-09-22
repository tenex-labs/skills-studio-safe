# Documentation

- [Architecture](architecture.md) — catalog, storage, runner, SSE, and product boundaries
- [Conventions](conventions.md) — catalog, SQLite, runner, tests, and frontend rules
- [Runner event model](event-model.md) — ephemeral progress versus saved final results
- [Privacy](privacy.md) — local content, CLI disclosure, trust, logs, and backups

## Runbooks

- [Local development](runbooks/local-development.md) — install, start, diagnose, and verify
- [Database backup and recovery](runbooks/database-recovery.md) — consistent backup and restore
- [Headless testing and troubleshooting](runbooks/headless-testing.md) — `claude -p`, bounds, and failures
- [Workshop demo](runbooks/workshop-demo.md) — Library-to-Compare demonstration and fallback

## Challenges

Each file in [`../challenges/`](../challenges/) is an independent, roughly 20-minute path: validator
rule, comparison assertion, test preset, precedence/conflict UX, accessibility, or a self-defined
slice. Prefer deterministic fixtures; a real headless run is optional unless the exercise says
otherwise.

The root `README.md` owns the product overview. Architecture and operating details live here.
