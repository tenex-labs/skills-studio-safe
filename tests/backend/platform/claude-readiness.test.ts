import { describe, expect, it, vi } from 'vitest';

import {
  createClaudeEnvironment,
  getClaudeReadiness,
} from '../../../app/backend/platform/claude-readiness.ts';

describe('Claude readiness', () => {
  it('returns only availability, authentication, and a safe version', async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: '2.1.170 (Claude Code)\n' })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          loggedIn: true,
          credential: 'must-not-escape',
          subscriptionType: 'max',
        }),
      });

    await expect(
      getClaudeReadiness(command, { PATH: '/bin', HOME: '/home', SECRET: 'hidden' }),
    ).resolves.toEqual({
      available: true,
      authenticated: true,
      version: '2.1.170',
    });
    expect(command).toHaveBeenNthCalledWith(
      2,
      'claude',
      ['auth', 'status', '--json'],
      expect.objectContaining({ env: { PATH: '/bin', HOME: '/home' } }),
    );
  });

  it('reports an unavailable or unauthenticated CLI without leaking command output', async () => {
    await expect(
      getClaudeReadiness(async () => ({
        exitCode: 1,
        stdout: 'credential-shaped failure output',
      })),
    ).resolves.toEqual({ available: false, authenticated: false });
  });

  it('inherits only the allowlisted environment needed by Claude auth', () => {
    expect(
      createClaudeEnvironment({
        PATH: '/bin',
        HOME: '/home',
        CLAUDE_CODE_OAUTH_TOKEN: 'token',
        RANDOM_SECRET: 'hidden',
      }),
    ).toEqual({
      PATH: '/bin',
      HOME: '/home',
      CLAUDE_CODE_OAUTH_TOKEN: 'token',
    });
  });
});
