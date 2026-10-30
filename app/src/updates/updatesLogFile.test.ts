import { describe, expect, it, vi } from 'vitest';

const files = vi.hoisted(() => ({ exists: true, write: vi.fn(), text: vi.fn(), path: '' }));
vi.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///data/user/0/com.lilachat.app/files/' } },
  File: class {
    constructor(directory: { uri: string }, name: string) {
      files.path = `${directory.uri}${name}`;
    }
    get exists() {
      return files.exists;
    }
    write(content: string) {
      files.write(content);
    }
    text() {
      return files.text();
    }
  },
}));

/** José 30/10: the app kept closing; expo-updates read its whole log to purge it and ran out of memory. */
describe('emptyUpdatesLog', () => {
  it('writes the expo-updates log blank without reading it', async () => {
    const { emptyUpdatesLog, UPDATES_LOG_FILE } = await import('./updatesLogFile');
    expect(emptyUpdatesLog()).toBe(true);
    expect(files.path).toBe(`file:///data/user/0/com.lilachat.app/files/${UPDATES_LOG_FILE}`);
    expect(UPDATES_LOG_FILE).toBe('dev.expo.modules.core.logging.dev.expo.updates');
    expect(files.write).toHaveBeenCalledWith('');
    expect(files.text).not.toHaveBeenCalled();
  });

  it('no file, or a failing write, never stops the start', async () => {
    const { emptyUpdatesLog } = await import('./updatesLogFile');
    files.exists = false;
    expect(emptyUpdatesLog()).toBe(false);
    files.exists = true;
    files.write.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(emptyUpdatesLog()).toBe(false);
  });
});
