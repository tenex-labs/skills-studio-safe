import { execFile } from 'node:child_process';
import { basename } from 'node:path';

export type FolderPickerCommand = (command: string, args: string[]) => Promise<string>;

const run: FolderPickerCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', timeout: 120_000 }, (error, stdout) => {
      const path = stdout.trim();
      if (error || !path) reject(new Error('Folder selection was cancelled.'));
      else resolve(path.replace(/\/$/, ''));
    });
  });
};

export async function pickProjectDirectory(
  command: FolderPickerCommand = run,
  platform: NodeJS.Platform = process.platform,
): Promise<{ label: string; path: string }> {
  let path: string;
  if (platform === 'darwin') {
    path = await command('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Choose a project with Claude skills")',
    ]);
  } else if (platform === 'win32') {
    path = await command('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; if ($dialog.ShowDialog() -eq "OK") { $dialog.SelectedPath }',
    ]);
  } else {
    path = await command('zenity', ['--file-selection', '--directory', '--title=Choose a project']);
  }
  path = path.trim();
  if (path.length > 1) path = path.replace(/[\\/]+$/, '');
  return { path, label: basename(path) };
}
