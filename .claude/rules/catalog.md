---
paths:
  - 'app/backend/catalog/**/*.ts'
  - 'app/domain/skill.ts'
  - 'app/domain/frontmatter.ts'
  - 'app/frontend/features/library/**/*.tsx'
---

# Catalog rules

See `docs/conventions.md` and `docs/architecture.md#catalog-and-precedence`.

- Installed `SKILL.md` files are the source of truth; catalog rows are a cache.
- Scan project skills only under trusted, canonical roots. Reject traversal and symlink escapes.
- Personal skills win over same-name project skills. Mark the project copy shadowed; never merge.
- Keep malformed skills visible with findings instead of dropping them.
- Editor saves create versions only. `createSkill` is the only code that writes installed files.
