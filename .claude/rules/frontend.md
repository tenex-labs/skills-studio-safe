---
paths:
  - 'src/**/*.ts'
  - 'src/**/*.tsx'
---

# Frontend rules

- Keep components focused on presentation or orchestration, not both.
- Derive display state with pure functions; do not duplicate domain decisions in components.
- Model finite UI states explicitly, including loading, empty, error, permission, and success.
- Use semantic HTML, visible focus, keyboard-complete interaction, and announced status changes.
- Label seed, live, and simulated data clearly.
- Do not expose rejected telemetry fields in types, fixtures, logs, or UI.
