# Challenge: Setup diagnosis and readiness

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Make one setup failure easier to diagnose and recover from without exposing settings or credentials.

## Build

1. Run `npm run doctor` and find the diagnostic-to-readiness path.
2. Choose one state: unsupported Node, port conflict, missing hooks, or first event waiting.
3. Improve its actionable message or UI presentation.
4. Keep the check deterministic and distinguish “not checked,” “ready,” and “needs action.”

## Constraints

- The supported Node range is exactly `^20.19.0 || >=22.12.0`.
- Do not print settings contents, environment values, raw paths, or credentials.
- A listener is not this collector until its health response proves ownership.
- First-event readiness requires an accepted event, not an SSE connection.

## Acceptance

- The selected failure names the problem, evidence, recovery command, and expected successful state.
- Seed data stays usable while readiness needs action.
- Status is understandable without color alone.
- The improvement does not install hooks or mutate settings during doctor.

## Verify

Run the focused diagnostic test, `npm run doctor`, `npm test`, and `npm run build`. Manually verify
the matching readiness state with safe fixtures or dependency injection.

## Recovery and cleanup

Undo any temporary port listener or fixture. If hooks were installed during manual verification, run
`npm run disconnect:claude`.
