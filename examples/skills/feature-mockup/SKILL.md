---
name: feature-mockup
description: Create and iterate on a feature mockup without implementing production code.
---

# Feature mockup

Create a reviewable interaction mockup for a requested feature. Stop before production
implementation.

## Workflow

1. Read `CLAUDE.md`, `BRIEF.md`, `docs/architecture.md`, `docs/conventions.md`, and
   `docs/privacy.md`, then inspect the relevant current UI.
2. Restate the target user, outcome, constraints, and non-goals in a few lines.
3. Ask only consequential questions: ask when an answer changes the workflow, information hierarchy,
   permissions, state model, or acceptance criteria. Make a labeled reversible assumption for minor
   details.
4. Define the smallest flow and include loading, empty, error, permission, and success states.
5. If Paper MCP is connected, create the mockup there. Do not block on Paper.
6. Otherwise create a standalone HTML mockup under `artifacts/mockups/<feature-name>/index.html`.
   Keep it self-contained, accessible, responsive, and fictional; include no secrets or real
   telemetry.
7. Open the result for the user. If automatic opening is unavailable, print the exact local path and
   a command that serves or opens it.
8. Iterate on specific user feedback. Preserve agreed behavior unless the user changes it.
9. In the mockup or an adjacent `notes.md`, record:
   - agreed behavior;
   - unresolved product or UX questions;
   - assumptions;
   - states represented; and
   - production concerns intentionally deferred.
10. Summarize the reviewed behavior and artifact location, then stop.

## Boundaries

- Do not edit production application, collector, scripts, tests, or production dependencies.
- Do not imply that simulated approval controls affect Claude Code.
- Do not invent deployment, authentication, persistence, or cloud integration.
- Do not use prompts, messages, source code, diffs, tool arguments, commands, raw paths, environment
  values, secrets, or transcripts as mock data.
- Do not continue from approved mockup to production implementation without a separate explicit
  request.
