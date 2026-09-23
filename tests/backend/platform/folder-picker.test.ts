import { describe, expect, it, vi } from 'vitest';

import { pickProjectDirectory } from '../../../app/backend/platform/folder-picker.ts';

describe('pickProjectDirectory', () => {
  it('uses the native macOS picker and returns a useful label', async () => {
    const command = vi.fn().mockResolvedValue('/Users/test/projects/sample/\n');

    await expect(pickProjectDirectory(command, 'darwin')).resolves.toEqual({
      label: 'sample',
      path: '/Users/test/projects/sample',
    });
    expect(command).toHaveBeenCalledWith('osascript', expect.arrayContaining(['-e']));
  });

  it('uses a platform picker without accepting browser-provided paths', async () => {
    const command = vi.fn().mockResolvedValue('/home/test/sample\n');

    await expect(pickProjectDirectory(command, 'linux')).resolves.toEqual({
      label: 'sample',
      path: '/home/test/sample',
    });
    expect(command).toHaveBeenCalledWith('zenity', expect.arrayContaining(['--directory']));
  });
});
