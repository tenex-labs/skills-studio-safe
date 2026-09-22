import { describe, expect, it } from 'vitest';

import {
  InvalidHookPayloadError,
  hashIdentifier,
  normalizeHookPayload,
  sanitizeRepository,
} from '../../server/sanitize.ts';

const deterministicOptions = {
  now: () => new Date('2026-09-21T16:00:00.000Z'),
  createId: () => 'event-1',
};

describe('normalizeHookPayload', () => {
  it('keeps only allowlisted metadata and hashes identifiers', () => {
    const event = normalizeHookPayload(
      {
        hook_event_name: 'PreToolUse',
        session_id: 'raw-session',
        prompt_id: 'raw-prompt',
        agent_id: 'raw-agent',
        parent_agent_id: 'raw-parent',
        agent_type: 'code-reviewer',
        tool_name: 'Bash',
        cwd: '/Users/example/secret/project name',
        prompt: 'private prompt',
        tool_input: { command: 'rm -rf private' },
        source_code: "const secret = 'value'",
        diff: '+ confidential',
        env: { API_TOKEN: 'secret-token' },
        transcript_path: '/private/transcript.jsonl',
      },
      deterministicOptions,
    );

    expect(event).toEqual({
      id: 'event-1',
      timestamp: '2026-09-21T16:00:00.000Z',
      sessionId: hashIdentifier('raw-session'),
      promptId: hashIdentifier('raw-prompt'),
      agentId: hashIdentifier('raw-agent'),
      parentAgentId: hashIdentifier('raw-parent'),
      agentType: 'code-reviewer',
      kind: 'tool',
      action: 'use',
      status: 'started',
      toolCategory: 'shell',
      repository: 'project-name',
    });

    const stored = JSON.stringify(event);
    for (const sensitiveValue of [
      'raw-session',
      'raw-prompt',
      'private prompt',
      'rm -rf private',
      'source_code',
      'secret-token',
      '/Users/example',
      'transcript',
    ]) {
      expect(stored).not.toContain(sensitiveValue);
    }
  });

  it.each([
    ['SessionStart', 'session', 'start', 'started'],
    ['SessionEnd', 'session', 'end', 'completed'],
    ['UserPromptSubmit', 'prompt', 'submit', 'started'],
    ['PostToolUse', 'tool', 'use', 'succeeded'],
    ['PostToolUseFailure', 'tool', 'use', 'failed'],
    ['PermissionRequest', 'permission', 'request', 'blocked'],
    ['PermissionDenied', 'permission', 'deny', 'failed'],
    ['SubagentStart', 'subagent', 'start', 'started'],
    ['SubagentStop', 'subagent', 'stop', 'completed'],
    ['TaskCreated', 'task', 'create', 'started'],
    ['TaskCompleted', 'task', 'complete', 'completed'],
    ['PreCompact', 'compact', 'start', 'started'],
    ['PostCompact', 'compact', 'finish', 'completed'],
    ['Stop', 'stop', 'stop', 'completed'],
  ] as const)('normalizes %s', (hookName, expectedKind, expectedAction, expectedStatus) => {
    const event = normalizeHookPayload(
      { hook_event_name: hookName, session_id: 'session' },
      deterministicOptions,
    );

    expect(event).toMatchObject({
      kind: expectedKind,
      action: expectedAction,
      status: expectedStatus,
    });
  });

  it('rejects unrecognized or incomplete payloads', () => {
    expect(() =>
      normalizeHookPayload({ hook_event_name: 'Unknown', session_id: 'session' }),
    ).toThrow(InvalidHookPayloadError);
    expect(() => normalizeHookPayload({ hook_event_name: 'SessionStart' })).toThrow(
      InvalidHookPayloadError,
    );
  });
});

describe('sanitizeRepository', () => {
  it('returns only a safe basename label', () => {
    expect(sanitizeRepository('C:\\private\\Client Work\\repo.git')).toBe('repo');
    expect(sanitizeRepository('/private/a repo')).toBe('a-repo');
  });
});
