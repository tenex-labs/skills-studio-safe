---
name: concise-review
description: Review a small change and report only consequential findings.
---

# Concise review

Review the requested change for correctness, data loss, security, and missing verification.

1. Inspect the relevant behavior and tests before judging the diff.
2. Report only findings that can change the outcome.
3. For each finding, name the affected location, concrete failure mode, and smallest useful fix.
4. If there are no consequential findings, say so and mention any verification gap.

Do not edit files unless the user separately asks for a fix.
