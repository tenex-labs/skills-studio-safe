---
paths:
  - 'app/frontend/**/*.ts'
  - 'app/frontend/**/*.tsx'
---

# Frontend rules

- Keep components focused on presentation or orchestration, not both.
- Derive display state with pure functions; do not duplicate domain decisions in components.
- Model finite UI states explicitly, including loading, empty, error, permission, and success.
- Use semantic HTML, visible focus, keyboard-complete interaction, and announced status changes.
- Label personal/project source, effective precedence, draft/installed state, and active/saved state.
- Library, Editor, and the two-lane Test Lab must remain keyboard-complete and usable at 200% zoom.
- Announce validation changes, runner terminal states, and save outcomes.
- Never imply an ephemeral trace is saved or a draft is installed.
- Render sensitive skill, prompt, and result content only in the intended workspace, never in
  diagnostics or notification previews.
