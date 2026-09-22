# Privacy contract

Agent Mission Control uses allowlist construction, not capture-then-redact. A raw hook payload exists
only long enough to validate approved fields and create a new safe object.

## Allowed metadata

- Timestamp
- Hashed session, prompt, and agent identifiers
- Supported event name and normalized event kind
- Agent type
- Coarse tool category
- Success, failure, blocked, or completion status
- Duration
- Task status
- Permission outcome
- Sanitized repository label

## Rejected content

Do not store, log, stream, export, render, or place in error messages:

- Prompts or other user messages
- Assistant messages
- Source code or diffs
- Tool arguments or results containing content
- Shell commands
- Raw file paths, repository URLs, or home-directory details
- Environment variables
- Secrets or credentials
- Transcript contents or raw API bodies

The collector never reads Claude transcript files.

## Required controls

1. Treat inbound values as `unknown` and validate at the HTTP boundary.
2. Map only known event names and finite status values.
3. Hash identifiers and reduce repository data to a safe label.
4. Construct a fresh `MissionEvent`; never spread or serialize the source payload.
5. Test that representative forbidden fields are absent from storage, SSE, logs, and browser output.

Seed data must be fictional and clearly labeled. Approval actions are simulated and must not change
real Claude permissions. Facilitator scenarios must also remain local and must not be confused with
hook input.

Prometheus is not implemented. Any future metrics adapter requires a separate privacy review and
must not weaken this contract.
