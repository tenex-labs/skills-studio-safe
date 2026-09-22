# Challenge: Run comparison

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Make one comparison dimension more useful and honest across seed and live runs.

## Build

1. Find the Compare projection and two-run selection flow.
2. Choose one dimension: duration, event count, tool failures, subagents, tokens, or cost.
3. Add a pure comparison result with a short explanation.
4. Handle equal, missing, and unavailable values deliberately.

## Constraints

- Derive live evidence from `MissionEvent`; do not invent missing values.
- Live tokens and cost are unavailable. Seed tokens and cost are fictional demo values.
- Preserve keyboard operation and do not rely on color alone.
- Do not add Prometheus, another endpoint, or a dependency.

## Acceptance

- Two distinct runs can be selected and swapped.
- The chosen dimension handles higher, lower, equal, and unavailable cases.
- Seed and live provenance is clear.
- Empty or one-run states explain how to continue.

## Verify

Add focused projection and interaction tests, then run `npm test` and `npm run build`. Manually
compare two seed runs and, if available, one seed run with one live run.

## Recovery and cleanup

Use seed fixtures when no live session is available. Remove temporary fixtures after verification;
no hook setup is required for acceptance.
