import { describe, expect, it } from 'vitest';
import { BIG_FILE_BYTES, foldStorageRows, kindBreakdown } from './storage.js';

const MB = 1024 * 1024;

describe('storage (pending 13)', () => {
  it('says the two heaviest kinds of a chat', () => {
    expect(kindBreakdown({ image: 320 * MB, video: 1.1 * 1024 * MB, audio: 4 * MB })).toBe('Videos 1.1 GB · Fotos 320 MB');
    expect(kindBreakdown({ file: 2 * MB })).toBe('Documentos 2.0 MB');
    expect(kindBreakdown({})).toBe('');
  });

  it('folds the per-kind sums into chats, heaviest first', () => {
    const chats = foldStorageRows([
      { chatId: 'a', kind: 'image', bytes: 10 * MB, count: 4 },
      { chatId: 'b', kind: 'video', bytes: 40 * MB, count: 1 },
      { chatId: 'a', kind: 'audio', bytes: 2 * MB, count: 6 },
    ]);
    expect(chats).toEqual([
      { chatId: 'b', bytes: 40 * MB, count: 1, byKind: { video: 40 * MB } },
      { chatId: 'a', bytes: 12 * MB, count: 10, byKind: { image: 10 * MB, audio: 2 * MB } },
    ]);
    expect(BIG_FILE_BYTES).toBe(5 * MB);
  });
});
