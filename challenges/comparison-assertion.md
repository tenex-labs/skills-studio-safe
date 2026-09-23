# Challenge: Add a comparison assertion

**Time box:** about 20 implementation minutes after exploration.

## Outcome

Add one assertion that helps the Test Lab explain whether each result met an expectation.

## Build

1. Choose a bounded assertion such as exact phrase, prohibited phrase, or maximum length.
2. Evaluate it against a completed final result with a pure function.
3. Store the assertion definition and outcome with the test/result provenance.
4. Present pass, fail, and unavailable states in both Test Lab lanes.

## Constraints

- Do not evaluate partial trace chunks.
- A completed run and a passing assertion are separate facts.
- Preserve the immutable skill-version and test-case references.
- Meaning must not rely on color alone.

## Acceptance and verification

Two saved results can show different outcomes for the same assertion, including a concise reason.
Cover pass, fail, Unicode, empty output, and interrupted-run cases with focused tests.
