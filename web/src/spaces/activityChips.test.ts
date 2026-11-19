import { describe, expect, it, vi } from 'vitest';
import { ACTIVITY_READ_EVENT, announceActivityRead, spaceChatsCache, syncActivityChips } from './spaceCache';

/** José 19/11: «Hilos 1» in the sidebar while «Menciones y actividad» showed every thread read. */
describe('the «Hilos» and «Menciones» chips', () => {
  it('take the counts the dialog just read', () => {
    // Arrange
    spaceChatsCache.hydrate('s1:chats', { chats: [], activity: { mentions: 0, threads: 1 } }, Date.now());
    // Act
    syncActivityChips('s1', { mentions: 0, threads: 0 });
    // Assert
    expect(spaceChatsCache.get('s1:chats').value?.activity).toEqual({ mentions: 0, threads: 0 });
  });

  it('a space never seen is not invented', () => {
    syncActivityChips('nunca', { mentions: 2, threads: 1 });
    expect(spaceChatsCache.get('nunca:chats').value).toBeUndefined();
  });

  it('reading a thread tells the space on screen to ask again', () => {
    const heard = vi.fn();
    window.addEventListener(ACTIVITY_READ_EVENT, heard);
    announceActivityRead();
    window.removeEventListener(ACTIVITY_READ_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
