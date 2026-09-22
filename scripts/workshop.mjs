#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { connectClaudeHooks } from './connect-claude.mjs';
import { runDoctor } from './doctor.mjs';

export function classifyWorkshopAction(ports) {
  if (ports.every(({ status }) => status === 'free')) return 'start';
  if (ports.every(({ status }) => status === 'app-running')) return 'already-running';
  return 'blocked';
}

function printSecondTerminalStep(claudeAvailable) {
  console.log('');
  console.log('Claude Code must be launched from this repository in a second terminal.');
  console.log(
    claudeAvailable
      ? 'Next step: open a second terminal here and run: claude'
      : 'Next step: install the Claude CLI, then open a second terminal here and run: claude',
  );
  console.log('Workshop UI: http://localhost:5173');
}

function startDevelopmentProcesses() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const useProcessGroup = process.platform !== 'win32';
  const child = spawn(npm, ['run', 'dev'], {
    stdio: 'inherit',
    shell: false,
    detached: useProcessGroup,
  });

  const forwardSignal = (signal) => {
    if (!child.pid || child.killed) return;
    try {
      if (useProcessGroup) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      child.kill(signal);
    }
  };
  const onSigint = () => forwardSignal('SIGINT');
  const onSigterm = () => forwardSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      resolve({ code, signal });
    });
  });
}

export async function runWorkshop() {
  console.log('Agent Mission Control workshop check');
  const { report, ok } = await runDoctor();
  if (!ok) {
    console.error('Resolve the failed checks above, then run npm run workshop again.');
    return 1;
  }

  console.log('');
  console.log('Installing project-local hooks owned by Agent Mission Control...');
  await connectClaudeHooks();
  printSecondTerminalStep(report.claude.available);

  const action = classifyWorkshopAction(report.ports);
  if (action === 'already-running') {
    console.log('Agent Mission Control is already running; no duplicate processes were started.');
    return 0;
  }
  if (action === 'blocked') {
    console.error(
      'The collector and UI are only partially available. Stop the existing listener(s), then run npm run workshop again.',
    );
    return 1;
  }

  console.log('Starting the collector and UI. Press Ctrl+C to stop both.');
  const result = await startDevelopmentProcesses();
  if (result.signal) return 0;
  return result.code ?? 1;
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runWorkshop()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(
        `Could not start the workshop safely: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      process.exitCode = 1;
    });
}
