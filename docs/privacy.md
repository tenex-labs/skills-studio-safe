# Target privacy and data contract

Claude Skill Studio handles content by design: skill bodies, test prompts, and final model output.
Privacy therefore depends on explicit purpose, local storage boundaries, redacted operational logs,
and honest disclosure—not on claiming content is never processed.

## Data classes

### Installed files

Personal and trusted-project `SKILL.md` files remain at their original filesystem locations. The
catalog reads them to validate and edit them. A project is not read until the user explicitly trusts
its root.

### SQLite

SQLite may contain trusted project roots, immutable skill-version content, test prompts, assertion
definitions, runner settings, and final results the user chose to save. It must not contain Claude
credentials, environment dumps, or automatic copies of partial traces.

### Ephemeral traces

Partial runner output is held in bounded memory and streamed to the active browser over loopback SSE.
It is discarded when the run ends, is cancelled, or the server restarts. Trace payloads must not be
written to general logs.

### Saved final results

A completed final response and assertion evidence become durable only through the save policy shown
in Test Lab. Saved results are linked to immutable version and test-case identifiers and can be
deleted without changing installed files.

## External disclosure

Tests invoke the locally installed `claude -p` and use its existing authentication. The selected
skill text, test prompt, and normal CLI context are sent to Anthropic under the user's Claude CLI
configuration. The Studio adds no cloud sync, analytics, hosted account, API key store, or remote
telemetry. “Local application” does not mean model inference is offline.

## Required controls

1. Bind the application server to loopback and restrict browser origins.
2. Treat paths and API payloads as untrusted; canonicalize roots and reject traversal or symlink
   escape.
3. Require explicit project trust before scan, read, write, test, or promotion.
4. Spawn `claude -p` without a shell, disable tools, enforce time/output limits, and support cancel.
5. Never log skill bodies, prompts, final output, trace chunks, credentials, environment values, or
   full home-directory paths.
6. Parameterize SQLite access and keep database and backup files outside version control.
7. Show whether final output will be saved, and never convert an interrupted trace into a result.
8. Redact user-facing errors while retaining actionable categories such as timeout or CLI auth
   failure.

Backups contain the same sensitive content as SQLite. Store them with user-only permissions, never
attach them to workshop submissions, and delete temporary restore copies after verification.
