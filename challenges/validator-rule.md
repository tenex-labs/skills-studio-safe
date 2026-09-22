# Challenge: Add a validator rule

**Time box:** about 20 implementation minutes after exploration.

## Outcome

Add one useful, deterministic `SKILL.md` validation finding, such as missing frontmatter
description, invalid name, or an empty instruction body.

## Build

1. Find the pure skill validator and its Library/Editor presentation.
2. Add one rule with a stable code, severity, concise message, and source location when available.
3. Show the finding on drafts and installed skills without blocking catalog discovery.
4. Add valid, invalid, and boundary fixtures.

## Constraints

- Do not read outside the selected skill directory.
- A malformed skill remains visible and repairable.
- Keep parsing/validation pure; do not write files or database rows.
- Avoid a broad parser rewrite.

## Acceptance and verification

The rule produces one predictable finding, does not duplicate existing findings, and clears after
the issue is fixed. Add focused validator and rendering tests, run them, then run
`npm run preflight` if available.
