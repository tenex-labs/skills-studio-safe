# Challenge: Decision policy and facilitator scenarios

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Apply a small, explainable policy to facilitator-injected decision scenarios.

## Build

1. Find the Decisions queue, facilitator injection seam, and local outcome state.
2. Define one pure policy, such as “high risk requires clarification before allow.”
3. Show the recommendation and a short reason on injected and seed scenarios.
4. Keep final Allow, Deny, and Clarify actions simulated and prevent duplicate resolution.

## Constraints

- Scenarios and actions must never change real Claude Code permissions.
- Do not display tool arguments, commands, raw paths, prompts, or code.
- Use semantic controls and provide an accessible name for each card and action.
- Keep state local; do not add persistence, a hook event, or a backend endpoint.

## Acceptance

- Policy recommendations are deterministic and explainable.
- Every simulated action has confirmation text and can be completed by keyboard.
- Empty and already-resolved states are understandable.
- The UI clearly says the scenario and outcome are simulated.

## Verify

Add focused tests for the policy boundary, one facilitator scenario, duplicate-action prevention,
and keyboard use. Run the focused test, then `npm test` and `npm run build`. Inject a scenario
manually and confirm no collector request occurs.

## Recovery and cleanup

Reload the browser to clear local scenarios and outcomes. If the policy grows beyond one explainable
rule, narrow it instead of adding a policy engine.
