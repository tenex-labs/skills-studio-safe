# Challenge: Improve precedence and conflict UX

**Time box:** about 20 implementation minutes after exploration.

## Outcome

Make a same-name personal/project skill conflict understandable and safe.

## Build

1. Create fixtures for one personal skill and one trusted-project skill with the same name.
2. Show both scopes and paths in a privacy-safe form.
3. Identify the project version as effective only in that project context.
4. Provide a clear action to open either source without merging or overwriting it.

## Constraints

- Never infer trust from recency, repository metadata, or parent directories.
- Do not delete or rename either skill automatically.
- Outside the project context, the personal skill remains effective.
- Use text and semantics, not color alone.

## Acceptance and verification

Users can answer which version is effective, why, and where each source lives. Cover trusted,
untrusted, no-conflict, and missing-file states with focused tests.
