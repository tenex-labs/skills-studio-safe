# Challenge: Accessibility pass

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Improve one complete workflow for keyboard, focus, semantics, and status announcements.

## Build

1. Choose setup readiness, Runs, Compare, or the simulated Decisions workflow.
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

Use seed data if live events are unavailable. Remove temporary debugging attributes and restore the
browser zoom after verification; no Claude hook change is needed.
