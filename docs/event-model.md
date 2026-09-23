# Run event model

The browser follows a run through `GET /api/studio/test-runs/:id/events`, a server-sent event
stream of `SkillTestTrace` objects (defined in `app/domain/testing.ts`).

```ts
type SkillTestTrace = { id: string; timestamp: string } & (
  | { kind: 'process'; state: 'queued' | 'preparing' | 'running' | 'initialized' }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; status: 'started' | 'completed' }
  | { kind: 'warning'; message: string }
  | { kind: 'result'; status: TerminalTestStatus }
);
```

`TerminalTestStatus` is `passed`, `failed`, `cancelled`, `timed-out`, or `interrupted`.

## Guarantees

- Every run emits exactly one `result` trace, and it is the last one. By the time it is sent, the
  run's final record is saved, so a client that sees it can fetch `GET /test-runs/:id` and get the
  final state.
- The server ends the stream after the `result` trace.
- A client that connects late receives the traces still in memory first, then live ones.
  Reconnecting can repeat traces, so clients should keep each trace `id` once.
- The trace window keeps the latest 500 traces per run and truncates free text to 4,000
  characters. It is not a history API.
- `tool` traces carry only a coarse category (`Skill`, `Shell`, `Filesystem`, `Network`, `Agent`,
  `Other`), never tool inputs or results.
- `warning` messages are fixed strings written by the runner. Claude's stderr is never forwarded.

## Status versus assertions

`status` describes the Claude process: `passed` means it exited cleanly with a successful result.
Assertions from a test case are evaluated once, against the final output, and stored separately in
`run.assertions`. A run can pass while one of its assertions fails.

## What gets saved

The run record is saved when the run is launched and updated once when it finishes: status,
timings, exit code, final output (up to 32,000 characters), usage, and assertion results. Traces
are never written to the database.
