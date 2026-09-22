# Challenge: Privacy inspector

**Time box:** about 20 implementation minutes after exploration and planning.

## Outcome

Let an attendee inspect which safe metadata a run uses and which content categories are rejected.

## Build

1. Read `docs/privacy.md` and find the normalized event presentation.
2. Add a small inspector for already-sanitized `MissionEvent` fields or rejection-category evidence.
3. Label hashed identifiers, sanitized repository labels, optional fields, and unavailable values.
4. Include a concise “never collected” list without rendering raw input.

## Constraints

- Inspect the safe object only; never retain or display the source hook payload.
- Do not add prompts, code, diffs, tool arguments, commands, raw paths, environment values, secrets,
  or transcripts to fixtures, logs, errors, state, or tests.
- Do not claim that hashing is authentication or reversible identity.
- Keep setup state and facilitator scenarios outside `MissionEvent`.

## Acceptance

- A viewer can distinguish stored metadata from rejected content.
- Missing optional fields are absent or labeled unavailable, not invented.
- The inspector works with seed data and is keyboard accessible.
- Representative forbidden keys remain absent from storage, SSE, and rendered output.

## Verify

Add a focused rendering test and a privacy-boundary regression test. Run them, then `npm test` and
`npm run build`. Review the diff for machine-specific paths and copied payloads.

## Recovery and cleanup

Delete any local payload samples immediately; do not commit or paste them into an issue. No Claude
session is required. If hooks were enabled for optional manual proof, run `npm run disconnect:claude`.
