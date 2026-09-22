---
paths:
  - 'tests/**/*.ts'
  - 'tests/**/*.tsx'
  - 'src/**/*.test.ts'
  - 'src/**/*.test.tsx'
  - 'server/**/*.test.ts'
---

# Test rules

- Assert observable behavior and privacy boundaries, not implementation details.
- Use deterministic timestamps, identifiers, and fixtures.
- Cover loading, empty, error, permission, and success states when relevant.
- Prove sensitive input fields are absent from normalized and stored events.
- Prove collector and metrics failures preserve seed mode and do not block hook callers.
- Prefer focused tests beside the behavior they protect; avoid broad snapshots.
