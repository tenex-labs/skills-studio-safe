import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectMenu } from '../../../app/frontend/ui/SelectMenu';

describe('SelectMenu', () => {
  it('supports keyboard navigation and skips disabled options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectMenu
        label="Model"
        value=""
        placeholder="Choose a model"
        options={[
          { value: 'sonnet', label: 'Claude Sonnet' },
          { value: 'haiku', label: 'Claude Haiku', disabled: true },
          { value: 'opus', label: 'Claude Opus' },
        ]}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Model Choose a model/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('opus');
  });
});
