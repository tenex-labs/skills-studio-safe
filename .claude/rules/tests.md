---
paths:
  - 'tests/**/*.ts'
  - 'tests/**/*.tsx'
---

# Test rules

- Assert observable behavior, authority, trust, and persistence boundaries.
- Use deterministic timestamps, identifiers, and fixtures.
- Cover loading, empty, error, permission, and success states when relevant.
- Prove untrusted projects and escaping paths are not read.
- Cover personal/project precedence, immutable version provenance, runner bounds, cancellation, and
  terminal states.
- Prove partial traces are not saved and only completed final results enter durable history.
- Fake the runner by default; real `claude -p` tests must be explicit and opt-in.
- Prefer focused tests beside the behavior they protect; avoid broad snapshots.
