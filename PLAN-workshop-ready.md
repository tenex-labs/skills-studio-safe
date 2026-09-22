# Workshop-ready Agent Mission Control

This lean plan transforms the seeded dashboard into a dependable local Claude Code workshop tool.
The original `PLAN.md` remains the baseline implementation record. This plan owns the setup and
product-shape changes requested after reviewing that first version.

## Outcome

An attendee can install dependencies, run one workshop command, start Claude Code in this
repository, and understand whether the collector, hooks, and first live event are working. The
product uses a neutral engineering-tool UI organized around real runs, run comparison, subagent
activity, and simulated human decisions that facilitators can inject.

## Consequential decisions

- Keep the app local, project-scoped, content-free, and fail-open.
- Keep deterministic data as a fallback, but make the real connection state explicit.
- Remove Prometheus from the attendee critical path.
- Require Node `20.19+` or `22.12+`, matching the installed Vite runtime.
- Add `npm run doctor` for actionable diagnostics and `npm run workshop` as the normal entry point.
- Scope hook installation to this repository and say so before attendees launch Claude Code.
- Keep decisions simulated; the facilitator panel never grants real Claude permissions.
- Replace the overview/dashboard metaphor with three product areas: Runs, Compare, and Decisions.
- Use a restrained light-first interface with system typography, compact hierarchy, and semantic
  status color only.
- Derive live runs and subagent relationships exclusively from the safe `MissionEvent` contract.
- Do not add persistence, authentication, transcript access, prompt capture, or cloud services.

## Technical approach and code map

- `scripts/doctor.mjs` validates the exact Node range, Claude CLI availability, project scope,
  required files, ports, and current hook installation without exposing settings content.
- `scripts/workshop.mjs` runs diagnostics, installs owned project hooks, prints the two-terminal
  workflow, and starts the existing UI and collector processes.
- `server/` exposes safe setup readiness beside health and event APIs.
- `src/` presents setup status, run summaries, comparisons, subagent relationships, and a local
  facilitator decision queue.
- `shared/mission-event.ts` remains the only event contract.
- `tests/` proves diagnostic decisions, reversible setup, readiness reporting, live-event
  projection, comparison behavior, and simulated facilitator actions.
- `docs/` and `challenges/` teach the one-command path and offer independent extension seams.

## Checkpoints

### C1 — Foolproof local setup

- **C1.1** Correct the runtime contract and package metadata for Node `20.19+` or `22.12+`.
- **C1.2** Add an actionable doctor that distinguishes available, occupied-by-this-app, and
  conflicting ports.
- **C1.3** Add `npm run workshop` to install owned hooks, explain repository scope, and start the app.
- **C1.4** Expose collector, hook-installation, and first-event readiness without returning settings.
- **C1.5** Prove connect and disconnect remain idempotent and preserve unrelated settings.

### C2 — Neutral product shell

- **C2.1** Replace the theatrical dashboard with compact Runs, Compare, and Decisions navigation.
- **C2.2** Establish a light-first neutral token set with accessible dark-mode support.
- **C2.3** Show setup readiness persistently with actionable next steps.
- **C2.4** Preserve responsive layouts, visible focus, semantic status, and 44px targets.

### C3 — Useful workshop capabilities

- **C3.1** Make run detail explain lifecycle evidence and verification state.
- **C3.2** Project parent-child agent relationships into a readable subagent view.
- **C3.3** Compare two runs across status, duration, events, tool failures, subagents, tokens, and
  seeded cost, clearly labeling unavailable live values.
- **C3.4** Turn approvals into a human decision queue with facilitator-injected scenarios.
- **C3.5** Keep every decision local and visibly simulated.

### C4 — Attendee extension paths

- **C4.1** Rewrite setup and demo runbooks around `npm run workshop`.
- **C4.2** Update challenges for setup diagnosis, run comparison, subagent visualization, decision
  policy, and privacy inspection.
- **C4.3** Keep each challenge independently implementable in roughly 20 minutes.
- **C4.4** Rewrite architecture documentation from the shipped implementation.

### C5 — Verification and rehearsal

- **C5.1** Run formatting, lint, strict typecheck, focused tests, full tests, and production build.
- **C5.2** Verify seed-only startup and collector-down fallback.
- **C5.3** Verify safe hook ingestion creates a live run and subagent relationship.
- **C5.4** Run `doctor`, connect, and disconnect from a clean project-settings state.
- **C5.5** Exercise the wide and narrow UI flows in a browser.
- **C5.6** Attempt one real Claude CLI session; if credentials or interactive access block it, record
  that exact first unverified boundary.

## Verification

```bash
npm install
npm run doctor
npm run preflight
npm test
npm run build
```

Manual evidence:

- `npm run workshop` starts or recognizes the local app and prints the correct second-terminal step.
- The UI distinguishes collector ready, hooks installed, and first event received.
- A safe session and subagent event appear without prompt, code, arguments, commands, or raw paths.
- Run comparison handles seeded and unavailable live metrics honestly.
- Facilitator scenarios enter and leave the local decision queue without external effects.
- `npm run disconnect:claude` removes only owned hook entries.

## Risks

- **Claude CLI variance:** detect presence and report the observed version; do not guess unsupported
  authentication or installation steps.
- **Port ownership:** never treat an arbitrary listener as this app; verify the collector health
  response and fail with an actionable conflict.
- **Settings damage:** preserve the existing merge, ownership marker, backup, and cleanup behavior.
- **False live confidence:** readiness requires an accepted event, not merely an open SSE connection.
- **Privacy erosion:** richer views must derive from safe metadata, never content fields.
- **Workshop scope:** comparison and decisions stay deterministic and local; persistence and real
  permission control remain out of scope.

## Decision and execution log

- **2026-09-21:** Use the lean branch because current architecture and requested product direction
  are known.
- **2026-09-21:** Prioritize attendee setup reliability before product expansion.
- **2026-09-21:** Adopt Runs, Compare, and Decisions as the durable information architecture.
- **2026-09-21:** Keep the facilitator control panel simulated and local.
- **2026-09-21:** Simplify the theme before investing in a final visual identity.
- **2026-09-21:** Implement the one-command setup, readiness API, neutral Runs/Compare/Decisions
  shell, subagent projection, facilitator scenarios, revised challenges, and current architecture
  documentation.
- **2026-09-21:** Verify project hooks with Claude Code 2.1.170: the collector accepted a real prompt
  and session-end event and the UI rendered the live run. The model response remained unverified
  because the local Claude OAuth token had expired.
