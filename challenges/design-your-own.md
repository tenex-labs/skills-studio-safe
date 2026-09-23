# Challenge: Design your own slice

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Deliver one small Claude Skill Studio improvement without crossing product, trust, or persistence
boundaries.

## Define before coding

Write five short bullets:

1. **User:** who needs this?
2. **Outcome:** what becomes easier or clearer?
3. **Constraints:** which architecture, accessibility, and privacy rules apply?
4. **Non-goals:** what tempting adjacent work is excluded?
5. **Verification:** what evidence proves the behavior?

Ask only questions whose answers would materially change the slice.

## Constraints

- Keep installed files, immutable versions, test cases, ephemeral traces, and saved results distinct.
- Do not add Cursor skills, application auth, cloud services, deployment, or tool-enabled runs.
- Never trust a project implicitly or merge same-name skill content.
- Choose an existing Library, Editor, Test Lab, catalog, storage, or runner seam.
- Prefer one vertical slice with focused tests over placeholders.

## Acceptance

- The five bullets are explicit and the implementation matches them.
- Loading, empty, error, permission, and success states were considered.
- Sensitive content appears only where the privacy contract permits and never in operational logs.
- The final diff contains no unrelated cleanup.

## Verify

Run focused verification for the stated outcome, then `npm test`, `npm run build`, and a final diff
review against `docs/privacy.md` and `docs/architecture.md`.

## Recovery and cleanup

If the slice cannot be proved with fixtures in the time box, reduce it. Remove temporary databases,
skills, and runner output, and leave no generated artifacts.
