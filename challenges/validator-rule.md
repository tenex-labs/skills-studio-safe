# Challenge: Add a validator rule

**Time box:** about 20 implementation minutes after exploration.

## Outcome

`SKILL.md` gets one new, useful validation finding, such as an empty instruction body, a
description that never says when to use the skill, or a missing top-level heading.

## Build

1. Read the pure validator in `app/backend/catalog/validator.ts` and its tests.
2. Add one rule with a stable `id`, a severity, a short message, and a line number when you can.
3. Add valid, invalid, and boundary fixtures in `tests/backend/catalog/validator.test.ts`.
4. Confirm the finding appears in Library and Editor for an installed skill.

**Stretch:** Editor findings come from the last scan, so they do not update while you type.
`POST /api/studio/validate` already validates a working copy without saving it. Wire it into the
Editor so findings refresh after edits.

## Constraints

- Keep the validator pure: no file or database access.
- A skill with the new finding still appears in the catalog and can be edited.
- Avoid rewriting the parser; frontmatter parsing lives in `app/domain/frontmatter.ts`.

## Acceptance and verification

The rule produces one predictable finding, does not duplicate an existing one, and disappears once
the problem is fixed. Run the validator tests, then `npm run preflight`.
