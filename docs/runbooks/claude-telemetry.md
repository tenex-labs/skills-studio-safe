# Claude telemetry

Live telemetry is optional, local, project-scoped, and content-free. Seed data remains the fallback.

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- Claude CLI installed and authenticated
- This repository as the current working directory
- Dependencies installed

## Start and connect

From this repository:

```bash
npm run doctor
npm run workshop
```

Workshop installs only this repository's owned hook entries and starts the collector and UI. It must
preserve unrelated project settings and must not modify user-level Claude settings.

In a second terminal, also from this repository:

```bash
claude
```

Complete one small local interaction. Real-agent proof cannot be completed with seed data alone; it
requires the authenticated CLI session to emit a supported hook event.

## Expected evidence

- Readiness shows collector ready and project hooks installed.
- After the CLI interaction, first event received becomes ready.
- A live run appears; supported subagent events show parent-child relationships.
- The UI shows hashed identifiers and a sanitized repository label.
- No prompt, response, code, diff, argument, command, path, environment value, secret, or transcript
  appears in the event stream, logs, or UI.
- Live tokens and cost are labeled unavailable.
- Stopping the app does not interrupt Claude Code.

## Recovery

Run `npm run doctor`. If hooks are missing, use `npm run connect:claude`, then start a new Claude
session from this repository; already-running sessions may not pick up project hooks. If
authentication is missing, authenticate with the Claude CLI outside this app or continue in seed
mode.

If settings are unexpected, disconnect the owned entries and review the project-local settings diff.
Never replace the whole file or modify user-level settings.

## Cleanup

```bash
npm run disconnect:claude
```

Exit the Claude session and stop `npm run workshop` with `Ctrl-C`. Doctor should then report that the
owned hooks are not installed. Prometheus is not implemented and has no attendee cleanup step.
