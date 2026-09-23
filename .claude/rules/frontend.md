---
paths:
  - 'app/frontend/**/*.ts'
  - 'app/frontend/**/*.tsx'
---

# Frontend rules

See `docs/conventions.md#frontend`.

- `useStudio` owns state and talks to a `StudioApi`; views receive props and never fetch.
- Add new API methods to the `StudioApi` interface and to both `api.ts` and `demo-api.ts`.
- Put display logic in pure helpers in `model/skill-view-model.ts`.
- Label scope, precedence, draft versus installed, and run status in words, not color alone.
- Announce async outcomes with `role="status"` or `role="alert"`; keep every flow keyboard-complete.
- Never imply a live trace is saved or a draft is installed.
- Styles go in `shell/styles.css` using its existing custom properties.
