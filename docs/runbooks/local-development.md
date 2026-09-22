# Local development

## Install and start

```bash
npm install
npm run dev
```

Open the printed loopback URL. Use an installed, authenticated Claude CLI only for a real Test Lab
run; the application must reuse existing CLI authentication.

Run `npm run preflight` before handoff.

## Development checks

- Library shows personal skills and no project skills until a root is explicitly trusted.
- Same-name personal/project skills show both sources and the personal winner.
- Editing a draft does not change its installed file.
- Test Lab can use fixtures without invoking Claude; an integration test may invoke bounded
  no-tools `claude -p` only when explicitly enabled.
- Partial traces disappear after termination; completed final results survive restart.
- `npm run preflight` runs formatting, lint, typecheck, tests, and build.

## Reset and cleanup

Stop the dev process with `Ctrl-C` and cancel any active test first. Do not delete personal or
project skills to reset application state. Back up SQLite, then use the implementation's explicit
reset path or remove only the documented local application-data directory. Never commit the
database, backups, traces, or generated test output.
