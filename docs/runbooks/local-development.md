# Local development

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- npm
- A local checkout of this repository

An authenticated Claude CLI is required only to prove a real live event. Seed fallback, the product
screens, and challenge work do not require Claude after dependencies are installed.

## Normal start

```bash
npm install
npm run workshop
```

Open the printed UI URL. Expected readiness is:

- collector ready;
- project hooks installed;
- first event waiting, until a Claude session emits one.

For live proof, open a second terminal in this repository and run `claude`. Authentication is owned
by the Claude CLI, not this app.

## Diagnose and develop

```bash
npm run doctor
npm run dev
```

`doctor` checks the exact Node range, Claude CLI availability, required files, ports, repository
scope, and owned hook state. `dev` starts the UI and collector without installing hooks.

For repository verification:

```bash
npm run preflight
npm test
npm run build
```

## Expected evidence

- Runs, Compare, and Decisions open with clearly labeled deterministic seed data.
- Setup readiness distinguishes collector, hooks, and first accepted live event.
- Facilitator scenarios and decision outcomes are labeled simulated.
- Live run tokens and cost are unavailable unless proven; seed values remain fictional.
- Tests and build finish without TypeScript errors.

## Recovery

Run `npm run doctor` and follow its first failing check. If live setup cannot be repaired quickly,
continue with seed data. For ports, settings, and hooks, use
[`troubleshooting.md`](troubleshooting.md).

## Reset and cleanup

Stop the workshop process with `Ctrl-C`, exit any Claude session started for the exercise, and run:

```bash
npm run disconnect:claude
```

Disconnect removes only hook entries owned by this repository. Restarting `npm run workshop` resets
the in-memory collector; reload the browser to reset local simulated decisions. Do not add a cloud
service or database as a setup workaround.
