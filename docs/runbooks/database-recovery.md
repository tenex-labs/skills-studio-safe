# Database backup and recovery

The SQLite database holds trusted project paths, skill versions, test cases, and run records. It is
not the source of truth for installed skills; those stay on disk. See [privacy](../privacy.md) for
the database location on each platform.

## Back up

1. Cancel active Test Lab runs and stop the dev server. The database uses WAL mode, so copying only
   `studio.sqlite` while the server runs can miss recent writes.
2. Copy `studio.sqlite` (and any `-wal` or `-shm` files beside it) to a dated folder outside every
   repository.
3. Check the copy: `sqlite3 <copy>/studio.sqlite "PRAGMA integrity_check;"` should print `ok`.

Backups contain skill text, prompts, and model output. Keep them private.

## Restore

1. Stop the server and move the current database aside as a rollback copy.
2. Run the integrity check on the backup, then copy it into place.
3. Start the app. Migrations bring an older backup up to date. A backup from a newer version of
   the app is refused rather than downgraded.
4. Open Library to rescan. Installed files win wherever the database disagrees.

## Recovering a skill's content

Studio does not write versions back to disk, and the Editor timeline shows only summaries. To bring
back an older version, read its files from a copy of the database and paste what you need into the
installed file yourself:

```bash
sqlite3 <copy>/studio.sqlite \
  "SELECT v.label, f.path, f.content FROM skill_versions v
   JOIN version_files f ON f.version_id = v.id
   JOIN skills s ON s.id = v.skill_id
   WHERE s.name = 'my-skill' ORDER BY v.created_at DESC;"
```

## If migration or integrity fails

Stop, restore the rollback copy, and keep the failed file locally for diagnosis. Never fix a schema
problem by deleting personal or project skills.
