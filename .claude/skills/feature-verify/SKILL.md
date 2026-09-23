---
name: feature-verify
description: Verify a finished Skill Studio change against its brief, mockup review, and plan, then report evidence and remaining risk.
disable-model-invocation: true
---

# Feature verify

Verify the final change against the selected feature brief, mockup review, and implementation plan.

Run the focused tests for the changed behavior, then `npm run preflight`. A passing command without
the relevant behavior under test is not enough evidence.

Inspect the diff for scope drift and duplication.

Report:

- user-visible behavior,
- consequential decision made,
- focused and full check results,
- browser evidence,
- trust, privacy, persistence, and accessibility boundaries preserved,
- changed files,
- first unverified risk.
