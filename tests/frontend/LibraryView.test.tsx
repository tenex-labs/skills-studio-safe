import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LibraryView } from '../../app/frontend/features/library/LibraryView';

describe('LibraryView', () => {
  it('uses the native folder picker before explicitly trusting a project', async () => {
    const user = userEvent.setup();
    const onRegisterProject = vi.fn().mockResolvedValue({
      id: 'project-1',
      label: 'sample',
      path: '/Users/test/sample',
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
});
