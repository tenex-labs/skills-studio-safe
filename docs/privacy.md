# Privacy and data handling

Skill Studio handles sensitive content by design: skill files, test prompts, and model output. This
page states exactly where that content goes.

## What leaves your machine

Test runs call your local `claude` CLI, which sends the skill, the prompt, and normal Claude Code
context to Anthropic under your existing Claude account and settings. "Local app" does not mean
inference is offline. Studio itself adds no cloud sync, analytics, telemetry, or hosted account.

## What stays on your machine

| Data             | Where                                                                                                                                                     | How long                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Installed skills | Their original folders                                                                                                                                    | Studio never deletes them                        |
| SQLite database  | macOS: `~/Library/Application Support/Claude Skill Studio/`; Linux: `$XDG_DATA_HOME/claude-skill-studio/`; Windows: `%LOCALAPPDATA%\Claude Skill Studio\` | Until you delete it                              |
| Traces           | API server memory                                                                                                                                         | Until 60 s after the run ends, or server restart |
| Temp skill copy  | A private temp directory (mode 700)                                                                                                                       | Deleted when the run ends                        |

The database holds trusted project paths, skill versions, test cases, and run records, including
prompts and final output. Every run is saved automatically when it starts and when it finishes.
The database file is created with owner-only permissions. It never holds credentials or
environment values.

## What a test run can do

- **No tools** (default): the model can only answer.
- **Read-only repository**: the model can use `Read`, `Glob`, and `Grep`. With a trusted workspace
  selected, that means it can read that project.
- No write, shell, network, or MCP tools are ever enabled. Each run has a turn limit (at most 20),
  a timeout (10–300 s), and a $0.25 budget cap.
- With a trusted workspace selected, Claude loads that project's `.claude` settings, just as it
  would if you ran `claude` there yourself. Only trust projects whose settings and hooks you trust.
- The process receives only the environment variables it needs to find and authenticate the CLI
  (`PATH`, `HOME`, locale, and Claude credential variables).

## Controls in the code

1. The API binds to loopback, checks browser origins, and requires a per-process capability for
   every change.
2. Paths are canonicalized; traversal and symlink escapes are rejected.
3. Projects are read only after explicit trust through the native folder picker.
4. `claude -p` is spawned without a shell; the prompt is sent on stdin, never as an argument.
5. Traces drop tool inputs, tool results, and stderr before anything reaches the browser.
6. Server logs never contain prompts, skill content, output, credentials, or environment values.

Backups of the database contain the same sensitive content. Keep them outside repositories and
never attach them to workshop submissions.
