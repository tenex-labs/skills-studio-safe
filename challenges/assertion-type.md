# Challenge: Add an assertion type

**Time box:** about 20 implementation minutes after exploration.

## Outcome

Test cases can check one new property of a run's final output, and Test Lab shows the result in
both lanes.

Today a test case supports two assertion types: the output must contain a phrase, or must not.

## Build

1. Pick one bounded type: maximum length, a required Markdown heading, a regular expression, or
   "mentions at least N of these phrases".
2. Extend `SkillTestCase` in `app/domain/testing.ts` and evaluate the new type in the pure
   `evaluateAssertions` function in `app/domain/assertions.ts`.
3. Store it: add a migration in `app/backend/storage/database.ts` (never edit an existing one) and
   accept the new field in the test-case route in `app/backend/api/routes.ts`.
4. Let users set it in the **Save as test case** dialog in Test Lab.

## Constraints

- Evaluate only the final output, never partial traces.
- Run status and assertion results stay separate: a run can pass while an assertion fails.
- Existing test cases without the new field keep working.
- Pass and fail must be readable without color.

## Acceptance and verification

Two runs of the same test case can show different outcomes for the new assertion. Add focused tests
for pass, fail, empty output, and Unicode in `tests/domain/assertions.test.ts`, plus a storage
round trip, then run `npm run preflight`.
