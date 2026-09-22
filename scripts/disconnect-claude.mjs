#!/usr/bin/env node

import {
  backupPath,
  pathExists,
  readBackup,
  readJsonObject,
  removeFile,
  removeOwnedHooks,
  sameJson,
  settingsPath,
  writeJsonAtomic,
} from './claude-settings.mjs';

async function disconnect() {
  const settingsExist = await pathExists(settingsPath);
  const backup = await readBackup();

  if (!settingsExist) {
    if (backup) await removeFile(backupPath);
    console.log('Agent Mission Control Claude hooks are already disconnected.');
    return;
  }

  const current = await readJsonObject(settingsPath);
  const { settings: cleaned, removed } = removeOwnedHooks(current);

  if (backup && sameJson(cleaned, backup.settings)) {
    if (backup.existed) {
      await writeJsonAtomic(settingsPath, backup.settings);
    } else {
      await removeFile(settingsPath);
    }
  } else {
    await writeJsonAtomic(settingsPath, cleaned);
  }

  if (backup) await removeFile(backupPath);

  console.log(
    removed === 0
      ? 'No Agent Mission Control hook entries were present.'
      : `Removed ${removed} Agent Mission Control hook entries.`,
  );
  console.log('Other project-local Claude settings and hooks were preserved.');
  console.log(`Settings checked: ${settingsPath}`);
}

disconnect().catch((error) => {
  console.error(
    `Could not disconnect Claude hooks safely: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  process.exitCode = 1;
});
