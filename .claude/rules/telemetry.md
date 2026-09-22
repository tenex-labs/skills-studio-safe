---
paths:
  - 'server/**/*.ts'
  - 'scripts/**/*'
  - 'src/**/telemetry*.ts'
  - 'src/**/event*.ts'
---

# Telemetry rules

- Validate every hook and metrics payload at the boundary.
- Construct stored events from an allowlist; never retain the source payload.
- Reject prompts, messages, code, diffs, tool arguments, commands, raw paths, environment variables,
  secrets, and transcript content.
- Hash external identifiers and sanitize repository labels before storage.
- Acknowledge hooks quickly and contain failures; telemetry must not block Claude Code.
- Never read Claude transcript files or silently enable content-bearing telemetry.
- Settings changes must be project-local, merged, reversible, and backed up outside version control.
