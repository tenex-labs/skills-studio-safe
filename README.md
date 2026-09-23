# Claude Skill Studio

A local app for discovering, editing, validating, and testing Claude Code skills. It reads personal
skills in `~/.claude/skills` and skills in projects you explicitly trust under
`<project>/.claude/skills`.

## Quick start

Requires Node 20.19+ or 22.12+ and, for live test runs, an authenticated `claude` CLI.

```bash
npm install
npm run dev        # API on 127.0.0.1:4319, UI on http://localhost:4320
npm run preflight  # format, lint, typecheck, test, build
```

If the API is not running, the UI falls back to a clearly labeled demo catalog so you can still
explore it.

## What it does

| Area         | What you can do                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Library**  | Browse personal and trusted-project skills with their validation state and precedence conflicts. Trust a project through the native folder picker. Create a new skill. |
| **Editor**   | Edit a skill's files with a Markdown preview. Saving creates an immutable version in Studio's database. It never changes the installed files.                          |
| **Test Lab** | Run two configurations (version, model, effort, tool access, limits) against one prompt with `claude -p` and compare output, time, tokens, and cost side by side.      |

## Rules the app keeps

- **Installed files are the source of truth.** Studio reads them on every scan. Its database is a
  history and cache, not a copy to restore from.
- **Projects are never scanned until you trust them.** Trusting one folder does not trust its
  parent, siblings, or clones.
- **Personal skills win.** When a personal and a project skill share a name, Claude Code uses the
  personal one. The Library marks the project copy as shadowed; nothing is merged.
- **Tests are bounded.** Each run is a separate `claude -p` process with no tools by default, a
  turn limit, a timeout, a $0.25 budget cap, and no MCP servers. See
  [`docs/privacy.md`](docs/privacy.md) for exactly what leaves your machine.

## Where things are

- [`docs/`](docs/README.md): architecture, conventions, event model, privacy, and runbooks
- [`challenges/`](challenges/): workshop exercises, each about 20 minutes
- [`CLAUDE.md`](CLAUDE.md): the short brief Claude Code reads before working here
