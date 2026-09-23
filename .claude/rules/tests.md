---
paths:
  - 'tests/**/*.ts'
  - 'tests/**/*.tsx'
---

# Test rules

See `docs/conventions.md#tests`.

- Mirror `app/`: each source file's tests live at the same relative path under `tests/`.
- Assert observable behavior, not component internals. Use fixed timestamps and IDs.
- Fake the Claude process. Real `claude -p` runs are manual only.
- Cover path escapes, untrusted projects, precedence, runner limits, cancellation, every terminal
  status, and what is or is not persisted.
