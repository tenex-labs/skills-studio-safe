---
paths:
  - 'app/backend/testing/**/*.ts'
  - 'app/domain/**/*test*.ts'
---

# Runner rules

- Spawn direct `claude -p` without a shell and reuse existing CLI authentication.
- Disable tools and enforce timeout, output, concurrency, and cancellation bounds.
- Pass arguments separately; never interpolate prompts, paths, or skill content into commands.
- Normalize known runner events and emit one terminal outcome.
- Keep partial traces bounded, ephemeral, and absent from operational logs and SQLite.
- Distinguish process completion, assertion outcomes, and explicit result saving.
