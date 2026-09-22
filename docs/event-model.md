# Target runner event model

The runner converts bounded child-process progress into one browser-facing shape. Names may be
adjusted during integration, but the persistence boundary must remain:

```ts
type RunnerEvent = {
  id: string;
  runId: string;
  sequence: number;
  timestamp: string;
  kind: 'started' | 'progress' | 'assertion' | 'completed' | 'failed' | 'timed_out' | 'cancelled';
  message?: string;
  assertionId?: string;
  assertionStatus?: 'passed' | 'failed';
};
```

## Invariants

- `timestamp` is an ISO 8601 string.
- `runId` is server-issued and `sequence` increases within a run.
- `kind` is finite; exactly one terminal event ends a run.
- `message` is bounded display output, not an operational log field.
- Events may be lost on disconnect or restart. SSE is not a history API.
- Tools are disabled; tool lifecycle events are not part of this model.
- Unknown CLI event shapes never pass through wholesale.

## Source mapping

The active trace is ephemeral. On successful completion, the server constructs a separate final
result containing terminal status, bounded final output, timings, assertion outcomes, and references
to the immutable skill version, test case, model/configuration, and runner version. Saving that final
result is an explicit database operation. Progress events themselves are not copied into SQLite.

Spawn errors, CLI authentication errors, timeout, cancellation, output-limit termination, and
malformed output remain distinct. A browser disconnect does not cancel a run unless the user asks;
it also does not guarantee trace replay.
