import { testRunLimits, type EffortLevel, type ToolPreset } from '../../../domain/index';
import type { SelectMenuOption } from '../../ui/SelectMenu';

export type LaneConfig = {
  versionId: string;
  model: string;
  effort: EffortLevel;
  toolPreset: ToolPreset;
  maxTurns: number;
  timeoutSeconds: number;
};

export function defaultLaneConfig(versionId: string, model: string): LaneConfig {
  return {
    versionId,
    model,
    effort: 'high',
    toolPreset: 'none',
    maxTurns: testRunLimits.maxTurns.default,
    timeoutSeconds: testRunLimits.timeoutSeconds.default,
  };
}

export const modelOptions: SelectMenuOption[] = [
  { value: 'default', label: 'Account default', description: 'Uses your configured default' },
  { value: 'best', label: 'Best available', description: 'Fable when available, otherwise Opus' },
  { value: 'fable', label: 'Latest Fable', description: 'Moving family alias' },
  { value: 'opus', label: 'Latest Opus', description: 'Moving family alias' },
  { value: 'sonnet', label: 'Latest Sonnet', description: 'Moving family alias' },
  { value: 'haiku', label: 'Latest Haiku', description: 'Moving family alias' },
  { value: 'opusplan', label: 'Opus plan / Sonnet execute', description: 'Hybrid mode' },
  { value: 'opus[1m]', label: 'Latest Opus · 1M context', description: 'Plan dependent' },
  { value: 'sonnet[1m]', label: 'Latest Sonnet · 1M context', description: 'Gateway dependent' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1', description: 'Deepest reasoning' },
  { value: 'claude-opus-5', label: 'Claude Opus 5', description: 'Complex agentic work' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5', description: 'Fast and capable' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fastest and lowest cost' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8', description: 'Legacy' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: 'Legacy' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Legacy' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5', description: 'Legacy' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Legacy' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', description: 'Legacy' },
];

export const effortOptions: Array<SelectMenuOption & { value: EffortLevel }> = [
  { value: 'low', label: 'Low', description: 'Fastest' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High', description: 'Model default' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Maximum' },
  { value: 'ultracode', label: 'Ultracode', description: 'Claude Code 2.1.203+' },
];

export const toolPresetOptions: Array<SelectMenuOption & { value: ToolPreset }> = [
  { value: 'none', label: 'No tools', description: 'Prompt-only evaluation' },
  { value: 'read-only', label: 'Read-only repository', description: 'Read, Glob, and Grep' },
];

export function toolPresetLabel(preset: ToolPreset): string {
  return toolPresetOptions.find(({ value }) => value === preset)?.label ?? preset;
}
