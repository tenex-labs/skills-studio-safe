---
paths:
  - 'app/backend/testing/**/*.ts'
  - 'app/domain/testing.ts'
  - 'app/domain/assertions.ts'
---

# Runner rules

See `docs/architecture.md#test-runs` and `docs/event-model.md`.

- Spawn `claude -p` directly with separate arguments; send the prompt on stdin.
- Tools are off by default. The read-only preset (`Read,Glob,Grep`) is the only other option.
- Enforce the limits in `testRunLimits`, the budget cap, concurrency, and cancellation.
- Every run ends with exactly one `result` trace, emitted after the final record is persisted.
- Keep traces bounded and in memory; never forward tool inputs, tool results, or stderr.
- Run status is the process outcome; assertion results are reported separately.
