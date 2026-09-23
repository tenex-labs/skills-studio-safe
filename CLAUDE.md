# Claude Skill Studio

A local app for managing and testing Claude Code skills: a React UI (Vite) and a loopback Node API
with SQLite. See `README.md` for the product and `docs/` for details.

## Commands

```bash
npm run dev        # API (tsx watch) and UI (Vite) together
npm test           # Vitest, all suites
npm run preflight  # format:check, lint, typecheck, test, build — run before handing off
```

## Code map

| Path                     | Owns                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `app/domain/`            | Shared types and pure logic used by both sides (frontmatter, assertions)    |
| `app/backend/api/`       | `server.ts`: HTTP, origin and capability checks, SSE. `routes.ts`: JSON API |
| `app/backend/catalog/`   | Skill discovery, trust, precedence, validation                              |
| `app/backend/storage/`   | SQLite schema, migrations, and queries                                      |
| `app/backend/testing/`   | The `claude -p` runner, stream parsing, test packages, trace window         |
| `app/backend/platform/`  | Claude CLI status and login, native folder picker                           |
| `app/frontend/state/`    | `StudioApi` interface, live and demo clients, `useStudio` orchestration     |
| `app/frontend/features/` | Library, Editor, and Test Lab views                                         |
| `app/frontend/model/`    | Pure display helpers                                                        |
| `app/frontend/ui/`       | Reusable components                                                         |
| `app/frontend/shell/`    | App frame, navigation, readiness bar, and the single `styles.css`           |
| `tests/`                 | Mirrors `app/` one-to-one                                                   |
| `.claude/`               | Path-scoped rules and example skills used in the workshop                   |

## Boundaries

- Editor saves create database versions only. The only code that writes installed skill files is
  `SkillCatalog.createSkill`.
- Never scan or run in a project the user has not trusted.
- Test runs have no tools unless the user picks the read-only preset (`Read,Glob,Grep`). Never add
  write, shell, network, or MCP tools.
- Traces stay in memory. Only the final run record is saved.
- Never log prompts, skill content, model output, credentials, or environment values.
- Out of scope: Cursor skills, deployment, app authentication, cloud sync, telemetry.

Conventions live in `docs/conventions.md`; path-scoped reminders live in `.claude/rules/`.
