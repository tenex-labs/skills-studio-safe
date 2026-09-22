# Agent Mission Control

Agent Mission Control is a local workshop app for understanding coding-agent runs, subagents, and
human decision points. From this repository, run:

```bash
npm install
npm run workshop
```

`workshop` checks the machine, installs this repository's owned Claude hooks, and starts the UI and
local collector. Open the URL it prints. In a second terminal, `cd` to this same repository and run:

```bash
claude
```

A successful setup shows the Runs, Compare, and Decisions navigation plus setup readiness for the
collector, project hooks, and first live event. The app remains usable with clearly labeled seed
data before a live event arrives. Proving the live path requires an authenticated Claude CLI session;
the app does not authenticate Claude for you.

## Check before starting

The supported Node.js range is exactly `^20.19.0 || >=22.12.0`. For actionable checks without
starting the app:

```bash
npm run doctor
```

Doctor reports Node and Claude CLI availability, required files, local port conflicts, repository
scope, and whether the owned hooks are installed. It does not inspect or print credentials, prompts,
transcripts, or full settings.

## What is included

- Runs and run detail derived from deterministic seed data and safe live lifecycle metadata
- Compare for two runs, with unavailable live values labeled instead of invented
- Parent-child subagent projection from hashed agent relationships
- Decisions with local facilitator scenario injection and simulated outcomes only
- Persistent setup readiness and seed fallback
- An allowlist privacy boundary before in-memory storage and SSE
- Independent workshop challenges under [`challenges/`](challenges/)

Prometheus is not implemented and is not required for attendees. It is only a possible future
extension.

## Commands

```bash
npm run workshop          # normal attendee start
npm run doctor            # diagnose setup without starting
npm run dev               # UI and collector without setup automation
npm run connect:claude    # install only owned project hooks
npm run disconnect:claude # remove only owned project hooks
npm run preflight         # format, lint, typecheck, tests, and build
npm test
npm run build
```

## Project scope and safety

The hooks are project-local and apply to Claude sessions started from this repository. They do not
grant permissions, alter user-level Claude settings, or make this app a production control plane.
Decision actions and facilitator scenarios are local simulations; they cannot allow or deny a real
Claude action.

The collector keeps approved metadata only. It rejects prompts, messages, source code, diffs, tool
arguments, commands, raw paths, environment values, secrets, and transcripts. A stopped or missing
collector must not block Claude Code.

## Cleanup

Stop `npm run workshop` with `Ctrl-C`, exit the second-terminal Claude session, then remove this
repository's owned hooks:

```bash
npm run disconnect:claude
```

The app has no database or deployed service to remove. See [`docs/README.md`](docs/README.md) for
architecture, privacy, setup, demo, troubleshooting, and challenge guidance.
