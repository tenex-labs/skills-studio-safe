# Claude Skill Studio agent guidance

Read `CLAUDE.md`, `docs/architecture.md`, `docs/conventions.md`, and `docs/privacy.md` before changing
behavior.

Keep the product local and filesystem-first. Personal `~/.claude/skills` and explicitly trusted
project `.claude/skills` are the only installed sources. The filesystem owns current installed
state; SQLite owns immutable versions, test cases, and saved final results. Active-run partial traces
are ephemeral and may be streamed over SSE, but must not become implicit history.

Use direct `claude -p` with the user's existing CLI authentication for bounded, no-tools tests.
Never read credentials, silently trust projects, enable write tools, add cloud sync, or imply that a
Studio version overwrites an installed skill. Cursor skills, deployment, and application
authentication are deferred.

Keep Library, Editor, and two-lane Test Lab behavior accessible and explicit about scope,
precedence, conflicts, run state, and persistence. Run focused tests and then `npm run preflight`.
Preserve unrelated working-tree changes and review for credentials,
machine-specific paths, database files, traces, and result content before handoff.
