---
paths:
  - 'app/backend/catalog/**/*.ts'
  - 'app/domain/**/*skill*.ts'
  - 'app/frontend/features/library/**/*.tsx'
---

# Catalog rules

- Treat filesystem `SKILL.md` files as installed authority.
- Scan project skills only under explicitly trusted, canonical project roots.
- Reject traversal and symlink escape; do not infer trust from repository metadata.
- Keep personal and project sources separate and compute precedence without merging content.
- Preserve malformed and conflicting skills as actionable catalog states.
- Promotion must name its scope, create an immutable version, and replace files atomically.
