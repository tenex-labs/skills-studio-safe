# Architecture

Claude Skill Studio is one local browser application and one loopback Node process.

## Components and flow

```text
personal ~/.claude/skills ───────┐
trusted project .claude/skills ──┴─> catalog scanner ─> Library / Editor
                                             |
                                             v
                                explicit promote writes SKILL.md

draft + immutable version + test case
                  |
                  v
        bounded runner -> direct `claude -p` (tools disabled, existing CLI auth)
                  |
       partial events over SSE ───────────────> Test Lab (ephemeral)
                  |
        completed final result
                  v
          SQLite -> Compare
```

## Authority and persistence

The data classes must not blur:

- **Installed files:** current `SKILL.md` files are the authority for what is installed. A catalog
  record is a cache/index, not proof that a file still exists.
- **Version database:** SQLite stores append-only skill-version snapshots, reusable test cases,
  trusted project roots, and supporting metadata. Updating an installed skill creates a new version;
  it does not mutate old version content.
- **Ephemeral traces:** accepted runner progress events exist only for the active process and SSE
  subscribers. Disconnecting the browser may lose them. They are not automatically stored.
- **Saved results:** completed terminal results become durable SQLite records. Each references the
  exact skill version, test case, runner settings, and outcome.

## Catalog and precedence

The catalog scans `~/.claude/skills` and only project roots the user explicitly trusted. It validates
that resolved paths stay within the expected skills root and does not follow an escaping symlink.
Malformed skills appear as actionable validation findings rather than disappearing.

Personal and project skills are separate installations. In the context of a trusted project, a
same-name personal skill wins over the project skill. The UI shows the conflict, both locations,
and the winner. Outside that project context, the personal skill remains effective. No content is
merged automatically.

## Product areas

- **Library:** sources, scope, validity, precedence, conflict, installed state, and rescan.
- **Editor:** draft text, validation findings, immutable version history, and explicit promotion.
- **Test Lab:** test-case presets, bounded runner state, transient trace, assertions, and final result.
- **Compare:** side-by-side saved results with version/test provenance and assertion differences.

## Runner boundary

The server starts `claude -p` directly as a child process. It reuses the Claude CLI's existing
authentication and supplies no API key. Every run has a fixed timeout, output limit, cancellation
path, and tools-disabled configuration. Input is passed without shell interpolation. The runner
captures structured progress where available, emits a small normalized event model over SSE, and
produces one terminal outcome. A timeout, cancellation, spawn failure, or malformed event is a
first-class terminal state.

The browser never starts processes or accesses skill files directly. The server validates all API
input and owns catalog, filesystem, SQLite, and process I/O.

## Consistency and recovery

- Rescan files after external edits; filesystem state wins for installed content.
- Before replacing an installed file, snapshot the previous valid content as an immutable version.
- Write promotion through a temporary file and atomic rename where the platform permits.
- Use SQLite transactions for linked version, test, assertion, and saved-result records.
- On startup, mark abandoned running records interrupted without inventing a final result.
- Do not reconstruct an installed skill from SQLite except through an explicit user recovery action.

## Intentionally omitted

Cursor skills, deployment, application authentication, cloud storage or sync, remote telemetry,
multi-user collaboration, background schedules, and tool-enabled Claude test runs.
