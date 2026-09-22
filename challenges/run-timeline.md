# Challenge: Subagent visualization

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Make parent-child agent activity understandable at a glance in run detail.

## Build

1. Find the run-detail subagent projection and its presentation.
2. Choose one improvement: nesting, agent summaries, event ownership, or unknown-parent handling.
3. Derive it only from normalized `agentId` and `parentAgentId` relationships.
4. Add useful empty, unknown-parent, and failed-event states.

## Constraints

- Derive relationships from hashed IDs and `parentAgentId`; do not infer from content.
- Do not add raw payload fields to `MissionEvent`.
- Meaning cannot depend on color alone.
- Keep the projection pure and the component presentational.
- Preserve seed fallback; a real-agent proof would require an authenticated Claude CLI session.

## Acceptance

- A viewer can identify the main agent and each child subagent.
- Relevant events show which agent owns them.
- Concurrent events remain ordered and readable.
- Empty, unknown-parent, and failure states do not crash the view.

## Verify

Add focused tests for the selected slice, including unknown or empty relationships. Run that test,
then `npm test` and `npm run build`. Manually verify Run detail with seed data.

## Recovery and cleanup

If live subagents are unavailable, use or extend safe seed fixtures. Revert temporary fixtures after
verification; no hook or settings change is required.
