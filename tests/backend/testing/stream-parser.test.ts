import { describe, expect, it } from 'vitest';

import { coarseToolName, parseStreamLine } from '../../../app/backend/testing/stream-parser.ts';

const line = (value: unknown) => JSON.stringify(value);

describe('parseStreamLine', () => {
  it('ignores blank lines and flags non-JSON or untyped lines as malformed', () => {
    expect(parseStreamLine('   ')).toEqual({ type: 'ignored' });
    expect(parseStreamLine('not-json')).toEqual({ type: 'malformed' });
    expect(parseStreamLine(line({ event: 'no type' }))).toEqual({ type: 'malformed' });
  });

  it('normalizes partial message events', () => {
    const partial = (event: unknown) => parseStreamLine(line({ type: 'stream_event', event }));

    expect(partial({ type: 'message_start' })).toEqual({ type: 'turn-started' });
    expect(
      partial({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } }),
    ).toEqual({ type: 'text-delta', text: 'Hi' });
    expect(
      partial({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Grep' } }),
    ).toEqual({ type: 'tool-started', tool: 'Filesystem' });
    expect(partial({ type: 'content_block_stop' })).toEqual({ type: 'block-stopped' });
  });

  it('keeps only text and coarse tool names from complete assistant messages', () => {
    expect(
      parseStreamLine(
        line({
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Answer' },
              { type: 'tool_use', name: 'Bash', input: { command: 'rm -rf /' } },
              { type: 'tool_result', content: 'secret' },
            ],
          },
        }),
      ),
    ).toEqual({ type: 'assistant-message', texts: ['Answer'], tools: ['Shell'] });
  });

  it('reads result success, output, and usage', () => {
    expect(
      parseStreamLine(
        line({
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: 'Done',
          usage: { input_tokens: 5, output_tokens: 2 },
          total_cost_usd: 0.002,
        }),
      ),
    ).toEqual({
      type: 'result',
      failed: false,
      result: 'Done',
      usage: { inputTokens: 5, outputTokens: 2, costUsd: 0.002 },
    });
    expect(parseStreamLine(line({ type: 'result', is_error: true }))).toEqual({
      type: 'result',
      failed: true,
      result: undefined,
    });
  });

  it('maps tool names to coarse categories', () => {
    expect(coarseToolName('WebFetch')).toBe('Network');
    expect(coarseToolName('Task')).toBe('Agent');
    expect(coarseToolName('mcp__custom__thing')).toBe('Other');
  });
});
