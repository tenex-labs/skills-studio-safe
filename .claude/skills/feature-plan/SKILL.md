---
name: feature-plan
description: Create a file-grounded implementation plan for the selected Skill Studio feature before any production file changes.
disable-model-invocation: true
---

# Feature plan

Create a file-grounded implementation plan for the selected Skill Studio feature.

Use:

- the codebase map,
- the selected feature brief,
- the reviewed feature mockup,
- the decisions and rejected alternatives from mockup review.

Include:

- ordered files and behavior to change,
- existing seams and helpers to reuse,
- domain, storage, UI, and error behavior where relevant,
- focused tests,
- browser verification,
- trust, privacy, accessibility, and recovery checks,
- risks and first rollback point.

Trace the existing behavior before naming a file. Do not introduce new infrastructure, broaden into
unrelated product areas, or treat drafts, installed files, versions, traces, and results as
interchangeable.

Do not edit files.
