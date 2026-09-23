# Claude Skill Studio

Claude Skill Studio is a local application for discovering, editing, validating, testing,
and comparing Claude Code skills. It manages personal skills in `~/.claude/skills` and skills in
explicitly trusted projects under `<project>/.claude/skills`. Cursor skills, deployment,
application authentication, and cloud services are outside this cutover.

## Install and start

From this repository:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite. Run the full repository checks with:

```bash
npm run preflight
```

## Product areas

- **Library** catalogs installed personal and trusted-project skills and reports conflicts.
- **Editor** saves through confirmation with automatic version history and rollback.
- **Test Lab** runs two bounded configurations against one prompt and aligns their outputs,
  assertions, usage, and timing.

Test Lab includes Claude Code's moving family aliases, 1M-context and hybrid aliases, current pinned
Fable/Opus/Sonnet/Haiku IDs, supported legacy versions, and effort levels from low through max
(plus Ultracode on compatible Claude Code versions). Organization and provider restrictions still
determine which selections can run.

The app uses the Claude CLI's existing authentication. It does not collect credentials, mint tokens,
or add a second sign-in flow. If Claude reports an expired OAuth token, Test Lab can launch the
official `claude auth login` flow; credentials remain owned by Claude Code.

## Personal and project skills

The filesystem is the installed authority:

- `~/.claude/skills/<name>/SKILL.md` is a personal installed skill.
- `<trusted-project>/.claude/skills/<name>/SKILL.md` is a project installed skill.
- An untrusted project is never scanned or modified.
- Project registration uses the operating system's native folder picker followed by explicit trust.
- In a trusted project context, a personal skill with the same name takes precedence over the
  project skill. The Library shows both sources and the effective winner; it does not silently
  merge them.

Trust is an explicit local choice recorded by the application. Trusting one project does not trust
its parent, siblings, remotes, or future clones.

## Edit, test, save

1. Select or create a personal or project skill.
2. Edit Markdown and preview it in one tabbed content area.
3. Choose the skill directly in Test Lab, enter one prompt, and configure two versions/models.
4. Run both configurations and compare readable output, assertions, timing, usage, and cost.
5. Save the winner to local Studio version history after confirmation; installed files stay
   untouched.

Managed or symlinked skills remain protected. Editing one creates an explicitly named personal copy
with its own version history instead of silently overwriting the managed source.

## Local data and privacy

Application state lives under the user's standard per-user application-data location, not this
checkout. On macOS the database is under `~/Library/Application Support/Claude Skill Studio/`.

The four data classes are deliberately separate:

1. **Installed files** — authoritative current skill text on the filesystem.
2. **SQLite records** — immutable skill versions, test cases, and completed final results,
   plus small catalog metadata such as trusted project roots.
3. **Ephemeral traces** — partial runner output held only for the active run and delivered over SSE;
   it is not durable history.
4. **Saved final results** — completed output and assertion evidence in SQLite.

Skill text, test prompts, and model output stay local to the machine except for the normal data sent
by the existing `claude -p` CLI session to Anthropic. The Studio adds no cloud sync, analytics,
deployment, or remote telemetry. See [`docs/privacy.md`](docs/privacy.md) for the privacy boundary.

## Recovery

- If the catalog looks stale, rescan the filesystem; do not reconstruct installed skills from the
  database.
- If a saved version is wrong, select another immutable version for the next experiment.
- Back up SQLite with its documented backup procedure while the app is stopped or through the
  implementation's consistent backup command.
- If a run is interrupted, discard the partial trace. Completed terminal results belong in history.
- Never trust or edit a project merely because it appears in recent files.

See [`docs/README.md`](docs/README.md) for architecture, runbooks, conventions, and workshop
exercises.
