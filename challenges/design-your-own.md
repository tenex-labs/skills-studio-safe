# Challenge: Design your own slice

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Deliver one small, coherent improvement without crossing the repository's product or privacy
boundaries.

## Define before coding

Write five short bullets:

1. **User:** who needs this?
2. **Outcome:** what becomes easier or clearer?
3. **Constraints:** which architecture, accessibility, and privacy rules apply?
4. **Non-goals:** what tempting adjacent work is excluded?
5. **Verification:** what evidence proves the behavior?

Ask only questions whose answers would materially change the slice. If interaction is uncertain,
use the example feature-mockup skill and stop the mockup before production implementation.

## Constraints

- Fit the change into the existing normalized event model unless an approved safe metadata field is
  genuinely required.
- Do not add a database, auth, cloud service, deployment, real approval control, or transcript access.
- Keep seed fallback complete and telemetry optional.
- Do not add Prometheus; choose an existing Runs, Compare, Decisions, readiness, or privacy seam.
- Prefer one vertical slice with focused tests over placeholders.

## Acceptance

- The five bullets are explicit and the implementation matches them.
- Loading, empty, error, permission, and success states were considered.
- No rejected content enters fixtures, logs, storage, SSE, or UI.
- The final diff contains no unrelated cleanup.

## Verify

Run focused verification for the stated outcome, then `npm test`, `npm run build`, and a final diff
review against `docs/privacy.md`.

## Recovery and cleanup

If the slice cannot be proved with seed data in the time box, reduce it. Remove temporary fixtures,
disconnect project hooks if you installed them, and leave no generated artifacts.
