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
- **Editor** supports a draft-test-promote loop without treating a draft as installed.
- **Test Lab** stores reusable test cases and runs bounded, no-tools checks through `claude -p`.
- **Compare** evaluates saved results across skill versions and test cases.

The app uses the Claude CLI's existing authentication. It does not collect credentials, mint tokens,
or add a second sign-in flow.

## Personal and project skills

The filesystem is the installed authority:

- `~/.claude/skills/<name>/SKILL.md` is a personal installed skill.
- `<trusted-project>/.claude/skills/<name>/SKILL.md` is a project installed skill.
- An untrusted project is never scanned or modified.
- In a trusted project context, a personal skill with the same name takes precedence over the
  project skill. The Library shows both sources and the effective winner; it does not silently
  merge them.

Trust is an explicit local choice recorded by the application. Trusting one project does not trust
its parent, siblings, remotes, or future clones.

## Draft, test, promote

1. Select an installed skill or start a draft.
2. Edit and validate the draft without changing the installed file.
3. Run one or more saved test cases through bounded `claude -p` processes with tools disabled.
4. Inspect the final result, assertions, timing, and any available partial trace.
5. Compare saved results when useful.
6. Promote an approved draft by writing the chosen personal or trusted-project `SKILL.md`.

Promotion creates an immutable version record before replacing an existing installed file. A saved
result remains linked to the exact version and test case that produced it.

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
- If a promoted file is wrong, restore the previous immutable version through an explicit recovery
  action and write it back to the intended scope.
- Back up SQLite with its documented backup procedure while the app is stopped or through the
  implementation's consistent backup command.
- If a run is interrupted, discard the partial trace. Completed terminal results belong in history.
- Never trust or edit a project merely because it appears in recent files.

See [`docs/README.md`](docs/README.md) for architecture, runbooks, conventions, and workshop
exercises.
