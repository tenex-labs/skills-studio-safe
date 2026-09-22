# Database backup and recovery

SQLite contains immutable skill versions, test cases, trusted project roots, and saved final
results. It is not the authority for installed skills.

## Locate and inspect

Stop the app. On macOS, the database is
`~/Library/Application Support/Claude Skill Studio/studio.sqlite`. Windows uses the current user's
local application-data directory; Linux uses `$XDG_DATA_HOME/claude-skill-studio` or
`~/.local/share/claude-skill-studio`.

## Back up

1. Cancel active Test Lab runs.
2. Stop the local server, or use a verified SQLite online-backup operation.
3. Copy the database with its file permissions to a dated file outside the repository.
4. If WAL mode is active, do not copy only the main file while the app is running.
5. Verify the backup with SQLite's integrity check and record the application schema version.

Backups contain skill text, prompts, and saved model output. Treat them as sensitive local files.

## Restore

1. Stop the app and preserve the current database as a rollback copy.
2. Restore the selected backup to a temporary path.
3. Run SQLite integrity checking before replacement.
4. Replace the database atomically and start the app so normal migrations run.
5. Rescan installed skill roots. Filesystem content wins if catalog metadata differs.
6. Verify Library sources, trusted roots, test cases, and several saved-result provenance links.

Do not write database versions over installed `SKILL.md` files during restore. Restoring an older
skill version is a separate explicit recovery action that previews target scope and content first.

## Failure recovery

If integrity or migration fails, stop, restore the rollback copy, and retain the failed file for
local diagnosis without uploading it. Never solve schema mismatch by deleting personal or project
skills.
