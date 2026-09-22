# Troubleshooting

Start with:

```bash
npm run doctor
```

Fix the first failed check, then rerun doctor. Keep seed data available. Never paste raw hook
payloads, environment values, settings contents, credentials, or transcripts into issues or logs.

## Checks

### Node version is unsupported

Use `^20.19.0 || >=22.12.0`. Node 20.0–20.18 does not satisfy the Vite runtime contract. Switch
versions, rerun `npm install`, then rerun doctor.

### Workshop does not start

Run `npm install`, then `npm run doctor`, then `npm run workshop`. Use the exact local URL printed by
the launcher. `npm run dev` is a fallback for app development but does not perform workshop setup.

### A port is occupied

Doctor distinguishes an instance of this app from an unrelated listener by checking the collector
health response. If it reports a conflict, stop the unrelated process and rerun doctor. Do not
assume any process on the expected port is safe to reuse.

### Collector readiness fails

Stop the workshop process, rerun `npm run workshop`, and reload the browser. Expected evidence is
collector ready or a clear seed fallback, never a blank application. An SSE connection alone does
not prove that a live event was received.

### Project hooks are missing

```bash
npm run connect:claude
npm run doctor
```

Confirm only owned entries were merged into this repository's project settings. Start a new Claude
session from this repository after installing hooks. Do not edit user-level settings.

### First event is still waiting

Collector and hook readiness are not real-agent proof. In a second terminal, `cd` to this repository,
run an authenticated `claude` session, and complete one small interaction. If the CLI is missing or
authentication fails, continue with seed data.

### A live run or subagent does not appear

Use a newly started Claude session in this repository. Only supported lifecycle events are projected,
and subagent relationships require safe `agentId`/`parentAgentId` metadata. Never inspect transcripts
or add content fields as a workaround.

### Settings are damaged or unexpected

Run `npm run disconnect:claude`, review the project-local settings diff, and use the connector's
recovery guidance if needed. Disconnect must remove only owned entries. Do not replace the full
settings file or modify user-level settings.

### Tokens or cost are unavailable

That is expected for live runs. The shipped event contract does not provide live usage or billing
data. Seed values are fictional. Prometheus is deferred and should not be added to recover a
workshop.

## Expected evidence

Seed mode still renders, Claude Code remains responsive, settings changes are reversible, and no
sensitive content appears in terminal output or browser data. Readiness reports facts separately
instead of collapsing them into a generic “live” state.

## Cleanup

```bash
npm run disconnect:claude
```

Stop local processes. Keep settings backups and generated artifacts untracked; delete them after
recovery is confirmed.
