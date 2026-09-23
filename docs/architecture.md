# Architecture

Claude Skill Studio is a browser UI and a Node API that listens only on `127.0.0.1:4319`. The API
owns every filesystem, database, and process operation; the browser only calls it.

```text
 ~/.claude/skills ─────────────────┐
 trusted <project>/.claude/skills ─┴─▶ catalog ─────▶ SQLite (skills, versions,
                                         │               ▲    test cases, runs)
                                         ▼               │ final run record
 Browser ◀── JSON (routes.ts) ─── API server ──▶ runner ─┴─▶ claude -p (one per run)
         ◀── SSE traces (server.ts) ───────────────┘
                     traces: in memory, bounded, evicted 60 s after the run ends
```

## Data and who owns it

| Data            | Lives in                    | Written by                                            |
| --------------- | --------------------------- | ----------------------------------------------------- |
| Installed skill | `SKILL.md` packages on disk | You, other tools, and Library's **New skill** only    |
| Catalog rows    | SQLite `skills`             | Every scan; a cache of the last scan, never restored  |
| Versions        | SQLite `skill_versions`     | A filesystem baseline per scan, plus each Editor save |
| Test cases      | SQLite `test_cases`         | Test Lab **Save as test case**                        |
| Run records     | SQLite `test_runs`          | Saved at launch, updated once when the run finishes   |
| Traces          | Runner memory               | The runner, while a run is active                     |

Versions are immutable. A save creates a new row whose parent is the version the editor started
from. If that base revision is unknown to Studio, the save is rejected with a revision conflict
instead of creating a version with no parent.

## Catalog and precedence

The catalog scans `~/.claude/skills` and the `.claude/skills` folder of each trusted project. It
resolves real paths and skips any package or file that escapes its root through a symlink.
Personal skills may be symlinks to managed locations; those are marked read-only in the UI.
Malformed skills still appear, with validation findings explaining what is wrong.

When a personal and a project skill share a command name, Claude Code uses the personal one. The
catalog marks the project skill `shadowedBy` the personal skill and adds a warning. Content is never
merged.

## Test runs

`POST /api/studio/test-runs` resolves the stored version, optional test case, and optional trusted
workspace, then hands them to `SkillTestRunner`:

1. The skill's files are copied into a private temp directory under a unique command name such as
   `skill-test-<id>`. The copy can never collide with, or overwrite, an installed skill.
2. The runner spawns `claude -p` directly (no shell) with the model, effort, budget, and tool
   settings, no MCP servers, and an allowlisted environment. The prompt goes in on stdin.
3. `stream-parser.ts` reduces each stream-json line to a small event. Tool inputs and results are
   dropped; tool names become coarse categories such as `Filesystem`.
4. The runner turns events into traces, enforces the turn limit, and kills the process group on
   timeout or cancel.
5. When the process ends, the runner records the final status, output, usage, and assertion
   results, persists the run, and only then emits the single `result` trace.

At most two runs execute at once; the rest queue. Finished runs stay in memory for 60 seconds so a
late client can still read them, then only the database copy remains. When the server starts, any
run still marked queued or running belongs to a process that no longer exists and is marked
`interrupted`.

With a trusted workspace selected, Claude starts in that project so it sees the project's own
context and settings, and the temp copy of the skill is added with `--add-dir`.

## Security at the HTTP boundary

- The server binds to loopback and rejects browser origins other than the Vite dev server and
  itself.
- Mutations must be JSON and carry the per-process capability from `GET /api/studio/session`. This
  stops other local web pages from changing Studio state.
- Request bodies are capped at 6 MB. Route handlers validate every field before use.
- Errors map to 400, 404, or 409 with a safe message. Anything unexpected is a generic 500.

## Frontend

`useStudio` holds application state and talks to a `StudioApi`. There are two implementations:
`studioApi` calls the server, and `createDemoApi()` serves fixtures from memory when the server is
unreachable. Views receive data and callbacks as props and do not fetch on their own.

## Not built

Restoring a version over an installed skill, deleting versions or runs, removing a trusted project
from the UI (the API supports it), live validation while typing, and run history in Test Lab.
Cursor skills, deployment, app authentication, cloud sync, and telemetry are out of scope.
