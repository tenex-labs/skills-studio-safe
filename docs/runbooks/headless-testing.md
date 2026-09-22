# Headless testing and troubleshooting

Test Lab invokes the installed Claude CLI directly with `claude -p`. It uses the
user's existing authentication, disables tools, and applies fixed time, output, and concurrency
bounds.

## Safe manual proof

Use a disposable test case and demo skill. Start one run from Test Lab and verify:

- the command is spawned without a shell;
- tools are unavailable;
- active progress arrives over loopback SSE;
- cancel and timeout terminate the child process;
- a terminal result identifies the exact skill version and test case;
- the partial trace is absent after restart;
- the final result is durable only when the UI's save policy says it is saved.

Avoid pasting the generated command into a shell: the application should pass arguments directly.

## Common failures

- **CLI missing:** install the supported Claude CLI and restart the app.
- **Authentication required:** authenticate through the Claude CLI outside the Studio. The Studio
  must never request or store the credential. `claude auth status` can report an account even when
  an OAuth access token has expired; the live run result is authoritative.
- **Timeout/output limit:** narrow the test or bounds; retain the terminal category but do not save
  partial output as a completed result.
- **SSE disconnected:** the run may continue, but trace replay is not guaranteed. Reconnect for
  current state and inspect the terminal result.
- **Run appears stuck:** cancel once, verify the child process exits, and inspect redacted server
  diagnostics. Never dump the prompt or process environment.
- **Assertion fails:** preserve the model result and assertion evidence separately; a completed run
  can have failed assertions.
- **Project skill unavailable:** confirm the project is explicitly trusted and rescan. Do not widen
  trust automatically.

Use deterministic fake-runner tests in normal CI. Real `claude -p` proof is opt-in because it
depends on local authentication, network access, model behavior, and usage limits.
