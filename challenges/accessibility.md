# Challenge: Accessibility pass

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Improve one complete workflow for keyboard, focus, semantics, and status announcements.

## Build

1. Choose Library, Editor, or one Test Lab lane.
2. Navigate it using only the keyboard and inspect its accessible names and landmarks.
3. Fix the highest-impact problems: semantic controls, visible focus, logical order, labels, and
   announced asynchronous or status changes.
4. Add a focused regression test where it protects behavior.

## Constraints

- Preserve existing mouse behavior and visual hierarchy.
- Prefer native HTML over recreating controls with ARIA.
- Do not hide focus outlines without an equally visible replacement.
- Status meaning cannot depend on color, position, or animation alone.

## Acceptance

- The workflow is complete with keyboard only.
- Focus enters, moves through, and leaves the workflow predictably.
- Controls and status changes have meaningful accessible names.
- Loading, empty, error, permission, and success states are understandable.

## Verify

Run the focused accessibility test, manually repeat the keyboard workflow at 200% zoom, then run
`npm test` and `npm run build`.

## Recovery and cleanup

Use fake-runner fixtures if Claude is unavailable. Remove temporary debugging attributes and
restore browser zoom after verification; no real CLI run is required.
