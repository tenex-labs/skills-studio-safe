# Challenge: Add a test preset

**Time box:** about 20 implementation minutes after exploration.

## Outcome

Add one reusable Test Lab preset that creates a valid test case without hiding its settings.

## Build

1. Define a focused preset, for example concise explanation or structured checklist.
2. Populate prompt, assertions, timeout, and output limit through the existing test-case model.
3. Let the user review and edit the generated test case before running.
4. Label the preset as a starting point, not a saved result.

## Constraints

- Presets never enable tools or select an untrusted project.
- Do not include credentials, machine paths, or real client content.
- Keep defaults bounded and deterministic.
- Creating a preset does not mutate an installed skill.

## Acceptance and verification

The preset produces a valid editable test case, survives save/reload, and starts a fake-runner test
with expected bounds. Add focused model and interaction tests.
