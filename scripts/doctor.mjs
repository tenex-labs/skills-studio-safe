#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readOwnedHookStatus } from './claude-settings.mjs';
import { SUPPORTED_NODE_RANGE, isSupportedNodeVersion } from './runtime.mjs';

export const COLLECTOR_PORT = 4319;
export const UI_PORT = 5173;

const projectRoot = import.meta.url.startsWith('file:')
  ? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  : process.cwd();
const requiredFiles = [
  'package.json',
  'vite.config.ts',
  'server/index.ts',
  'server/collector.ts',
  'scripts/connect-claude.mjs',
  'scripts/disconnect-claude.mjs',
];

function executableName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

export function getCommandVersion(command, args = ['--version']) {
  return new Promise((resolveVersion) => {
    execFile(
      executableName(command),
      args,
      { encoding: 'utf8', timeout: 10_000, maxBuffer: 16 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolveVersion({ available: false });
          return;
        }
        const firstLine = `${stdout || stderr}`.trim().split(/\r?\n/, 1)[0]?.slice(0, 160);
        resolveVersion({ available: true, version: firstLine || 'version unavailable' });
      },
    );
  });
}

function probeHttp(host, port, pathname) {
  return new Promise((resolveProbe) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolveProbe(result);
    };
    const probe = request(
      {
        host,
        port,
        path: pathname,
        method: 'GET',
        timeout: 600,
        headers: { Accept: 'application/json, text/html' },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (body.length < 32 * 1024) body += chunk;
        });
        response.on('end', () => finish({ listening: true, status: response.statusCode, body }));
      },
    );
    probe.once('timeout', () => {
      probe.destroy();
      finish({ listening: true });
    });
    probe.once('error', (error) => {
      finish({
        listening: error && typeof error === 'object' && error.code !== 'ECONNREFUSED',
      });
    });
    probe.end();
  });
}

export async function inspectWorkshopPort(port) {
  const isCollector = port === COLLECTOR_PORT;
  const host = isCollector ? '127.0.0.1' : 'localhost';
  const probe = await probeHttp(host, port, isCollector ? '/api/health' : '/');
  if (!probe.listening) return { port, status: 'free' };

  if (isCollector) {
    try {
      const body = JSON.parse(probe.body ?? '');
      if (probe.status === 200 && body?.service === 'agent-mission-control-collector') {
        return { port, status: 'app-running' };
      }
    } catch {
      // A listener with a non-JSON response is not this collector.
    }
  } else if (
    probe.status === 200 &&
    probe.body?.includes('<title>Agent Mission Control</title>') &&
    probe.body.includes('/src/main.tsx')
  ) {
    return { port, status: 'app-running' };
  }

  return { port, status: 'conflict' };
}

async function inspectRequiredFiles() {
  const checks = await Promise.all(
    requiredFiles.map(async (file) => {
      try {
        await access(resolve(projectRoot, file));
        return undefined;
      } catch {
        return file;
      }
    }),
  );
  return checks.filter(Boolean);
}

export async function getDoctorReport() {
  const [npm, claude, missingFiles, hooks, collectorPort, uiPort] = await Promise.all([
    getCommandVersion('npm'),
    getCommandVersion('claude'),
    inspectRequiredFiles(),
    readOwnedHookStatus().catch(() => ({ status: 'error' })),
    inspectWorkshopPort(COLLECTOR_PORT),
    inspectWorkshopPort(UI_PORT),
  ]);

  return {
    node: {
      version: process.versions.node,
      range: SUPPORTED_NODE_RANGE,
      supported: isSupportedNodeVersion(process.versions.node),
    },
    npm,
    claude,
    missingFiles,
    hooks,
    ports: [collectorPort, uiPort],
  };
}

export function hasBlockingDiagnostics(report) {
  return (
    !report.node.supported ||
    !report.npm.available ||
    report.missingFiles.length > 0 ||
    report.hooks.status === 'error' ||
    report.ports.some(({ status }) => status === 'conflict')
  );
}

export function printDoctorReport(report, log = console.log, error = console.error) {
  const printCheck = (passed, message) => (passed ? log(`✓ ${message}`) : error(`✗ ${message}`));

  printCheck(report.node.supported, `Node ${report.node.version} (required: ${report.node.range})`);
  printCheck(report.npm.available, `npm ${report.npm.version ?? 'not found'}`);
  if (report.claude.available) {
    log(`✓ Claude CLI ${report.claude.version}`);
  } else {
    log('! Claude CLI not found; install it before starting the second-terminal session.');
  }
  printCheck(
    report.missingFiles.length === 0,
    report.missingFiles.length === 0
      ? `Required project files (${requiredFiles.length})`
      : `Missing required files: ${report.missingFiles.join(', ')}`,
  );
  if (report.hooks.status === 'installed') {
    log('✓ Project-local Claude hooks installed');
  } else if (report.hooks.status === 'missing') {
    log('! Project-local Claude hooks missing; npm run workshop installs them safely.');
  } else {
    error('✗ Project-local Claude settings could not be checked safely.');
  }
  for (const port of report.ports) {
    const label = port.port === COLLECTOR_PORT ? 'collector' : 'UI';
    const descriptions = {
      free: 'free',
      'app-running': 'this app is already running',
      conflict: 'conflicting local listener',
    };
    const message = `Port ${port.port} (${label}): ${descriptions[port.status]}`;
    if (port.status === 'conflict') error(`✗ ${message}`);
    else log(`✓ ${message}`);
  }
}

export async function runDoctor() {
  const report = await getDoctorReport();
  printDoctorReport(report);
  return { report, ok: !hasBlockingDiagnostics(report) };
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runDoctor()
    .then(({ ok }) => {
      if (!ok) process.exitCode = 1;
    })
    .catch(() => {
      console.error('✗ Doctor failed unexpectedly without exposing local configuration.');
      process.exitCode = 1;
    });
}
