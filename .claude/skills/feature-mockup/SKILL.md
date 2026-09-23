---
name: feature-mockup
description: Create a reviewable standalone HTML mockup of a selected Skill Studio feature from its feature brief.
disable-model-invocation: true
---

# Feature mockup

Use the Skill Studio codebase map and the selected feature brief from the previous steps, or the ones
supplied in the prompt.

Design the smallest interface that communicates the proposed behavior:

- reuse Skill Studio's existing language and visual hierarchy,
- show the smallest complete user flow,
- include applicable loading, empty, error, trust or permission, and success states,
- use semantic controls, visible focus, useful labels, and status text that does not rely on color,
- use fictional local data only.

Create one standalone HTML document. When you can write files, save it to a disposable location
outside the production source, open it in the browser, and say where you saved it. When you cannot,
return the complete HTML document.

Also return:

1. the assumptions the mockup tests,
2. interaction and state notes,
3. decisions that still require human review.

Do not produce framework code, backend changes, migrations, or production implementation. Do not edit
production files.
