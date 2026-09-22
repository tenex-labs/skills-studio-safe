import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';

describe('Agent Mission Control', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('collector unavailable')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens Runs by default and keeps a safe setup fallback visible', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Runs' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overview/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText('Setup status is unavailable. Seed mode continues.'),
      ).toBeInTheDocument(),
    );
  });

  it('filters runs and explains lifecycle, verification, and subagents', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /needs attention/i }));
    expect(screen.getByText('Repair payment retry reconciliation')).toBeInTheDocument();
    expect(screen.queryByText('Add audit log export endpoint')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Inspect Repair payment retry reconciliation' }),
    );

    expect(screen.getByRole('heading', { name: 'Lifecycle evidence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verification' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent activity' })).toBeInTheDocument();
    expect(screen.getByText('2 subagents')).toBeInTheDocument();
    expect(screen.getByText('Fictional seed')).toBeInTheDocument();
  });

  it('supports empty, partial, and complete comparisons', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^compare$/i }));
    expect(screen.getByText('Select two runs to compare their evidence.')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'First run' }), 'run-atlas-27');
    expect(screen.getByText('Select one more run to complete the comparison.')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Second run' }), 'run-ember-31');
    const comparison = screen.getByRole('region', { name: 'Run comparison' });
    expect(within(comparison).getByText('Elapsed duration')).toBeInTheDocument();
    expect(within(comparison).getByText('$3.84')).toBeInTheDocument();
    expect(within(comparison).getByText('Passed')).toBeInTheDocument();
  });

  it('injects and resolves a facilitator scenario locally', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^decisions/i }));
    await user.click(screen.getByRole('button', { name: /risky shell action/i }));

    const scenario = screen
      .getByRole('heading', { name: 'Review a potentially destructive local shell action' })
      .closest('article');
    expect(scenario).not.toBeNull();
    expect(within(scenario!).getByText('Simulation only', { exact: false })).toBeInTheDocument();

    await user.click(within(scenario!).getByRole('button', { name: 'Deny locally' }));
    expect(
      within(scenario!).getByText('Marked denied locally. No external action was taken.'),
    ).toBeInTheDocument();
  });
});
