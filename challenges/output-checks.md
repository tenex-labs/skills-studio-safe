# Challenge: Add output checks to Test Lab

**Time box:** about 20 implementation minutes after exploration.

## Outcome

A user can say what a good answer must contain, run both configurations, and see a clear pass or
fail for each check in each lane.

The backend already supports this. A **test case** is a saved prompt plus phrases the output must
or must not contain. When a run is launched with a test case, the runner checks the final output
and stores the results in `run.assertions`. Test Lab does not expose any of it yet.

## Build

1. Read `SkillTestCase` in `app/domain/testing.ts`, `evaluateAssertions` in
   `app/domain/assertions.ts`, and the `test-cases` and `test-runs` routes in
   `app/backend/api/routes.ts`.
2. Add `testCases` and `createTestCase` to the `StudioApi` interface and to both clients
   (`api.ts` and `demo-api.ts`).
3. In Test Lab, let the user add "must contain" and "must not contain" phrases under the prompt,
   save them with the prompt, and send the test case ID with each run.
4. Show each check's pass or fail result in both lanes.

**Stretch:** add one new check type, such as maximum length, in `evaluateAssertions`, with a new
migration for its column.

## Constraints

- Check only the final output, never partial traces.
- Run status and check results stay separate: a run can pass while a check fails.
- Use words people already know in the UI; avoid introducing "assertion" as a label.
- Pass and fail must be readable without color.

## Acceptance and verification

Two lanes given the same prompt can show different check results. Add focused tests for the new UI
and for pass, fail, and empty output, then run `npm run preflight`.
