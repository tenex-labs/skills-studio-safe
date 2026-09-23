# Challenge: Improve precedence and conflict UX

**Time box:** about 20 implementation minutes after exploration.

## Outcome

When a personal and a project skill share a name, a user can tell which one Claude Code will use,
why, and where each lives.

Today the project copy is marked "Shadowed: a personal skill with this name wins", but the Library
never shows the two side by side, and the personal skill gives no hint that it hides anything.

## Build

1. Use the demo catalog (stop the API) or create a personal and a trusted-project skill with the
   same name.
2. Mark both skills in the conflict, not only the shadowed one, and show both locations.
3. Make the effective skill obvious: Claude Code uses the personal skill.
4. Let the user open either skill from the conflict without merging or overwriting anything.

## Constraints

- Precedence is computed in `app/backend/catalog/catalog.ts`; do not recompute it in components.
- Never infer trust from recency, repository metadata, or parent folders.
- Do not delete or rename either skill automatically.
- Use text and semantics, not color alone.

## Acceptance and verification

A user can answer which skill is effective, why, and where each lives. Cover the no-conflict,
conflict, and untrusted-project cases with focused tests, then run `npm run preflight`.
