import type { SkillTestRun } from '../../domain/index.ts';

/**
 * One line of `claude -p --output-format stream-json`, reduced to the few facts the runner uses.
 * Anything else, including tool inputs and tool results, is deliberately dropped here so it can
 * never reach a trace.
 */
export type ClaudeStreamEvent =
  | { type: 'ignored' }
  | { type: 'malformed' }
  | { type: 'initialized' }
  | { type: 'turn-started' }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-started'; tool: string }
  | { type: 'block-stopped' }
  | { type: 'assistant-message'; texts: string[]; tools: string[] }
  | { type: 'result'; failed: boolean; result?: string; usage?: SkillTestRun['usage'] };

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Tool names are reported only as coarse categories so traces never reveal what was touched. */
export function coarseToolName(name: string | undefined): string {
  const normalized = name?.toLowerCase() ?? '';
  if (normalized.includes('skill')) return 'Skill';
  if (normalized.includes('bash') || normalized.includes('shell')) return 'Shell';
  if (['read', 'write', 'edit', 'glob', 'grep', 'file'].some((part) => normalized.includes(part))) {
    return 'Filesystem';
  }
  if (normalized.includes('web') || normalized.includes('http')) return 'Network';
  if (normalized.includes('task') || normalized.includes('agent')) return 'Agent';
  return 'Other';
}

function parsePartialEvent(event: Record<string, unknown> | undefined): ClaudeStreamEvent {
  const eventType = readString(event, 'type');
  if (eventType === 'message_start') return { type: 'turn-started' };
  if (eventType === 'content_block_delta') {
    const delta = readRecord(event?.delta);
    const text = readString(delta, 'type') === 'text_delta' ? readString(delta, 'text') : undefined;
    return text ? { type: 'text-delta', text } : { type: 'ignored' };
  }
  if (eventType === 'content_block_start') {
    const block = readRecord(event?.content_block);
    return readString(block, 'type') === 'tool_use'
      ? { type: 'tool-started', tool: coarseToolName(readString(block, 'name')) }
      : { type: 'ignored' };
  }
  if (eventType === 'content_block_stop') return { type: 'block-stopped' };
  return { type: 'ignored' };
}

function parseAssistantMessage(message: Record<string, unknown> | undefined): ClaudeStreamEvent {
  const texts: string[] = [];
  const tools: string[] = [];
  const content = message?.content;
  for (const item of Array.isArray(content) ? content : []) {
    const block = readRecord(item);
    const blockType = readString(block, 'type');
    const text = readString(block, 'text');
    if (blockType === 'text' && text) texts.push(text);
    else if (blockType === 'tool_use') tools.push(coarseToolName(readString(block, 'name')));
  }
  return { type: 'assistant-message', texts, tools };
}

function parseResult(event: Record<string, unknown>): ClaudeStreamEvent {
  const usage = readRecord(event.usage);
  const inputTokens = readNumber(usage, 'input_tokens');
  const outputTokens = readNumber(usage, 'output_tokens');
  const costUsd = readNumber(event, 'total_cost_usd');
  const hasUsage = [inputTokens, outputTokens, costUsd].some((value) => value !== undefined);
  return {
    type: 'result',
    failed: event.is_error === true || readString(event, 'subtype') === 'error',
    result: readString(event, 'result'),
    ...(hasUsage ? { usage: { inputTokens, outputTokens, costUsd } } : {}),
  };
}

export function parseStreamLine(line: string): ClaudeStreamEvent {
  if (!line.trim()) return { type: 'ignored' };
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return { type: 'malformed' };
  }
  const event = readRecord(value);
  const type = readString(event, 'type');
  if (!event || !type) return { type: 'malformed' };

  switch (type) {
    case 'stream_event':
      return parsePartialEvent(readRecord(event.event));
    case 'assistant':
      return parseAssistantMessage(readRecord(event.message));
    case 'result':
      return parseResult(event);
    case 'system':
      return { type: 'initialized' };
    default:
      return { type: 'ignored' };
  }
}
