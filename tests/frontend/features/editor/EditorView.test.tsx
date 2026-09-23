import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SkillPackage } from '../../../../app/domain/index';
import { EditorView } from '../../../../app/frontend/features/editor/EditorView';

const readOnlySkill: SkillPackage = {
  id: 'managed-skill',
  name: 'managed-skill',
  description: 'Managed skill',
  scope: 'personal',
  relativePath: 'managed-skill',
  sourcePath: '/managed/skills/managed-skill',
  revision: 'sha256:base',
  fileCount: 1,
  readOnly: true,
  validation: { errors: 0, warnings: 0 },
  findings: [],
  files: [
    {
      path: 'SKILL.md',
      mode: 0o644,
      content: '---\nname: managed-skill\ndescription: Managed skill\n---\n\n# Managed\n',
    },
  ],
};

describe('EditorView', () => {
  it('allows read-only installed sources to produce editable Studio drafts', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({
      skill: { ...readOnlySkill, readOnly: false },
    });
    render(<EditorView skill={readOnlySkill} versions={[]} onSave={onSave} />);

    const editor = screen.getByRole('textbox', { name: 'File content' });
    expect(editor).not.toHaveAttribute('readonly');
    await user.type(editor, '\nDraft instruction.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('dialog', { name: 'Save this version?' })).toBeInTheDocument();
    expect(
      screen.getByText(/installed skill on your computer will not be changed/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/source is managed elsewhere/i)).toBeInTheDocument();
  });
});
