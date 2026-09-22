# Event model

Every lifecycle source normalizes into one safe browser-facing shape:

```ts
type MissionEvent = {
  id: string;
  timestamp: string;
  sessionId: string;
  promptId?: string;
  agentId?: string;
  parentAgentId?: string;
  agentType?: string;
  kind: 'session' | 'prompt' | 'tool' | 'permission' | 'subagent' | 'task' | 'compact' | 'stop';
  action: string;
  status: 'started' | 'succeeded' | 'failed' | 'blocked' | 'completed';
  toolCategory?: string;
  durationMs?: number;
  repository?: string;
};
```

## Invariants

- `timestamp` is an ISO 8601 string.
- External session, prompt, and agent identifiers are hashed before storage.
- `repository` is a sanitized label, never a raw path or remote URL.
- `toolCategory` is a coarse category, never a tool argument or command.
- `action` comes from a finite adapter mapping; it is not copied from free-form content.
- Optional fields are absent when unknown. Placeholder content is not invented.
- Normalization produces a new object and discards the raw payload.

## Source mapping

Seed fixtures directly construct valid events. Hook adapters validate supported lifecycle events and
map approved metadata into this shape. Setup readiness and facilitator scenarios are separate local
models; they are not lifecycle events and must not be forced into `MissionEvent`.

The UI derives runs, run detail, comparison evidence, counts, failures, and subagent relationships
from this contract. `agentId` identifies an agent and `parentAgentId` links a child to its parent;
missing or unknown parents must remain explicit rather than guessed from content. Source-specific
logic stays at input boundaries.

Seed run fixtures may contain fictional tokens and cost for comparison exercises. Live events do not
contain those metrics, so live comparison must label them unavailable. Prometheus is deferred and
does not enrich the shipped event stream.

## Supported lifecycle families

Session start/end, prompt submission metadata, tool start/success/failure, permission request/denial,
subagent start/stop, task creation/completion, pre/post compaction, and stop.

## Not represented

Setup diagnostics, hook installation state, SSE connection state, facilitator scenario text,
simulated decision outcomes, prompts, code, commands, tool arguments, raw paths, transcripts, tokens,
and cost are not `MissionEvent` fields.
