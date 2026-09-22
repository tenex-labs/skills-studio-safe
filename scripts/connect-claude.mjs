#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import {
  COLLECTOR_URL,
  HOOK_EVENTS,
  addOwnedHooks,
  backupPath,
  createBackup,
  pathExists,
  readJsonObject,
  settingsPath,
  writeJsonAtomic,
} from './claude-settings.mjs';

export async function connectClaudeHooks(log = console.log) {
  const existed = await pathExists(settingsPath);
  const current = await readJsonObject(settingsPath);
  const { settings, added } = addOwnedHooks(current);
  const backupCreated = await createBackup(current, existed);

  if (added > 0) {
    await writeJsonAtomic(settingsPath, settings);
  }

  log('Agent Mission Control Claude hooks are connected.');
  log(`Collector URL: ${COLLECTOR_URL}`);
  log(`Project settings: ${settingsPath}`);
  log(
    'Collected fields: timestamp, hashed identifiers, lifecycle status, safe tool category, duration, agent type, and sanitized repository label.',
  );
  log(
    'Never collected: prompts, messages, source, diffs, tool arguments, commands, raw paths, environment values, secrets, or transcripts.',
  );
  log(`Hook timeout: 1 second; collector failures remain non-blocking for Claude.`);
  log(
    added === 0
      ? 'No changes were needed; owned hook entries were already present.'
      : `Added ${added} hook event registrations (${HOOK_EVENTS.length} supported events).`,
  );
  if (backupCreated) {
    log(`Backup created: ${backupPath}`);
  }
  log('Undo: npm run disconnect:claude');

  return { added, backupCreated };
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  connectClaudeHooks().catch((error) => {
    console.error(
      `Could not connect Claude hooks safely: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    process.exitCode = 1;
  });
}
