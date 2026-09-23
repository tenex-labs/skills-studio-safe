import { execFile, spawn, type ChildProcess } from 'node:child_process';

export type ClaudeReadiness = {
  available: boolean;
  authenticated: boolean;
  version?: string;
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
};

export type ClaudeCommandRunner = (
  command: string,
  args: readonly string[],
  options: { env: NodeJS.ProcessEnv; timeoutMs: number },
) => Promise<CommandResult>;

const INHERITED_ENVIRONMENT_KEYS = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'CLAUDE_CONFIG_DIR',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
] as const;

export function createClaudeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of INHERITED_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  return environment;
}

const runCommand: ClaudeCommandRunner = (command, args, options) =>
  new Promise((resolve) => {
    execFile(
      command,
      [...args],
      {
        env: options.env,
        timeout: options.timeoutMs,
        maxBuffer: 64 * 1024,
        encoding: 'utf8',
      },
      (error, stdout) => {
        const exitCode =
          error && typeof error === 'object' && 'code' in error && typeof error.code === 'number'
            ? error.code
            : error
              ? 1
              : 0;
        resolve({ exitCode, stdout });
      },
    );
  });

function safeVersion(stdout: string): string | undefined {
  const firstLine = stdout.split(/\r?\n/, 1)[0]?.trim();
  const match = firstLine?.match(/^(\d+\.\d+\.\d+)(?:\s+\(Claude Code\))?$/);
  return match?.[1];
}

function isAuthenticated(stdout: string, exitCode: number): boolean {
  if (exitCode !== 0) {
    return false;
  }

  try {
    const status: unknown = JSON.parse(stdout);
    if (!status || typeof status !== 'object') {
      return false;
    }
    const record = status as Record<string, unknown>;
    return (
      record.loggedIn === true ||
      record.authenticated === true ||
      record.status === 'authenticated' ||
      record.status === 'logged_in'
    );
  } catch {
    return false;
  }
}

export async function getClaudeReadiness(
  commandRunner: ClaudeCommandRunner = runCommand,
  sourceEnvironment: NodeJS.ProcessEnv = process.env,
): Promise<ClaudeReadiness> {
  const env = createClaudeEnvironment(sourceEnvironment);
  const versionResult = await commandRunner('claude', ['--version'], {
    env,
    timeoutMs: 5_000,
  });
  const version = versionResult.exitCode === 0 ? safeVersion(versionResult.stdout) : undefined;

  if (!version) {
    return { available: false, authenticated: false };
  }

  const authResult = await commandRunner('claude', ['auth', 'status', '--json'], {
    env,
    timeoutMs: 5_000,
  });

  return {
    available: true,
    authenticated: isAuthenticated(authResult.stdout, authResult.exitCode),
    version,
  };
}

let activeLogin: ChildProcess | undefined;
let loginState: {
  state: 'idle' | 'running' | 'completed' | 'failed';
  finishedAt?: string;
} = { state: 'idle' };

export function startClaudeLogin(): { started: boolean } {
  if (activeLogin && activeLogin.exitCode === null) return { started: false };
  loginState = { state: 'running' };
  activeLogin = spawn('claude', ['auth', 'login'], {
    env: createClaudeEnvironment(),
    stdio: 'inherit',
    shell: false,
  });
  activeLogin.once('exit', (code) => {
    loginState = {
      state: code === 0 ? 'completed' : 'failed',
      finishedAt: new Date().toISOString(),
    };
    activeLogin = undefined;
  });
  activeLogin.once('error', () => {
    loginState = { state: 'failed', finishedAt: new Date().toISOString() };
    activeLogin = undefined;
  });
  return { started: true };
}

export function getClaudeLoginState() {
  return { ...loginState };
}

export function stopClaudeLogin(): void {
  if (activeLogin && activeLogin.exitCode === null) activeLogin.kill('SIGTERM');
  activeLogin = undefined;
  if (loginState.state === 'running') {
    loginState = { state: 'failed', finishedAt: new Date().toISOString() };
  }
}
