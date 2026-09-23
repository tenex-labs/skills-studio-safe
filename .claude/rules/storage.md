---
paths:
  - 'app/backend/storage/**/*.ts'
---

# Storage rules

See `docs/conventions.md#backend`.

- Add a new migration for every schema change; never edit a migration that has shipped.
- Use parameterized queries and transactions for multi-row writes.
- Skill versions are immutable. Run records are written at launch and updated once at finish.
- Never store traces, credentials, or environment values.
- A catalog row is not proof that a skill is installed.
