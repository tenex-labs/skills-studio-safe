import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LibraryView } from '../../../../app/frontend/features/library/LibraryView';

describe('LibraryView', () => {
  it('uses the native folder picker before explicitly trusting a project', async () => {
    const user = userEvent.setup();
    const onRegisterProject = vi.fn().mockResolvedValue({
      id: 'project-1',
      label: 'sample',
      path: '/Users/test/sample',
      available: true,
      skillCount: 0,
      trustedAt: '2026-09-22T12:00:00Z',
    });
    render(
      <LibraryView
        skills={[]}
        projects={[]}
        state="ready"
        error=""
        demoMode={false}
        onScopeChange={vi.fn()}
        onOpen={vi.fn()}
        onCreateSkill={vi.fn()}
        onRegisterProject={onRegisterProject}
        onForgetProject={vi.fn()}
        onPickProject={vi.fn().mockResolvedValue({ label: 'sample', path: '/Users/test/sample' })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Project' }));
    await user.click(screen.getByRole('button', { name: 'Choose project folder' }));
    await waitFor(() =>
      expect(onRegisterProject).toHaveBeenCalledWith({
        label: 'sample',
        path: '/Users/test/sample',
      }),
    );
  });

  it('creates a new personal skill from the library', async () => {
    const user = userEvent.setup();
    const onCreateSkill = vi.fn().mockResolvedValue(undefined);
    render(
      <LibraryView
        skills={[]}
        projects={[]}
        state="ready"
        error=""
        demoMode={false}
        onScopeChange={vi.fn()}
        onOpen={vi.fn()}
        onRegisterProject={vi.fn()}
        onForgetProject={vi.fn()}
        onPickProject={vi.fn()}
        onCreateSkill={onCreateSkill}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'New skill' }));
    await user.type(screen.getByRole('textbox', { name: 'Skill name' }), 'review-small-change');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Reviews small changes.');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    expect(onCreateSkill).toHaveBeenCalledWith({
      scope: 'personal',
      projectId: undefined,
      name: 'review-small-change',
      description: 'Reviews small changes.',
    });
  });

  it('explains a missing project folder and lets the user forget it', async () => {
    const user = userEvent.setup();
    const onForgetProject = vi.fn().mockResolvedValue(undefined);
    render(
      <LibraryView
        skills={[]}
        projects={[
          {
            id: 'moved',
            label: 'Old checkout',
            path: '/projects/old-name',
            trustedAt: '2026-09-22T12:00:00Z',
            available: false,
            skillCount: 0,
          },
        ]}
        state="ready"
        error=""
        demoMode={false}
        onScopeChange={vi.fn()}
        onOpen={vi.fn()}
        onRegisterProject={vi.fn()}
        onForgetProject={onForgetProject}
        onPickProject={vi.fn()}
        onCreateSkill={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Project' }));
    await user.click(screen.getByRole('button', { name: /Trusted project/ }));
    await user.click(screen.getByRole('option', { name: /Old checkout, Folder not found/ }));
    expect(screen.getByText(/no longer exists at \/projects\/old-name/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Forget project' }));
    const dialog = screen.getByRole('dialog', { name: 'Forget this project?' });
    await user.click(within(dialog).getByRole('button', { name: 'Forget project' }));
    expect(onForgetProject).toHaveBeenCalledWith('moved');
  });
});
