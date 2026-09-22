---
paths:
  - 'app/backend/versions/**/*.ts'
---

# Storage rules

- Use migrations, foreign keys, transactions, and parameterized SQLite queries.
- Keep immutable skill versions, run-bound test cases, and saved final results append-only.
- Never treat a catalog row as proof that a skill is installed.
- Never persist active partial traces or create a completed result for an interrupted run.
- Keep databases and backups outside the repository and out of logs.
- Recovery from a version to an installed file is explicit, previewed, and scoped.
