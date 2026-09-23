---
name: feature-brainstorm
description: Generate bounded Skill Studio feature candidates from a grounded product and codebase context map.
disable-model-invocation: true
---

# Feature brainstorm

Use the Skill Studio codebase map from the previous step, or the map supplied in the prompt. Read it
before proposing features.

Brainstorm 6–10 small Skill Studio features grounded in:

- observed user friction,
- existing capabilities and extension seams,
- product, trust, privacy, accessibility, and data-lifecycle boundaries.

Each candidate must fit one small vertical slice that can be implemented and verified. Include a mix
of workflow, interface, and developer-safety ideas.

For each idea, provide:

- user and problem,
- capability,
- likely owning area,
- value,
- uncertainty,
- smallest useful version,
- verification evidence.

Do not propose cloud services, application authentication, deployment, background agents, Cursor
skills, implicit project trust, test-run tools beyond the read-only preset, or new infrastructure.

Return the candidates in a reviewable form. Do not choose a winner until the user reviews the
options. Do not edit production files.
