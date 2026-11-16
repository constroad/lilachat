import { describe, expect, it } from 'vitest';
import { chatReadByMe, presentedOfChat } from './readElsewhere';

describe('a chat I read on another device (José 16/11: the notice stayed after reading on the web)', () => {
  it('my own read receipt names the chat whose notices go', () => {
    expect(chatReadByMe({ chatId: 'c1', userId: 'me', readSeq: 12 }, 'me')).toBe('c1');
  });

  it('someone else reading, a delivery only, or a broken frame clears nothing', () => {
    expect(chatReadByMe({ chatId: 'c1', userId: 'ana', readSeq: 12 }, 'me')).toBeNull();
    expect(chatReadByMe({ chatId: 'c1', userId: 'me', deliveredSeq: 12 }, 'me')).toBeNull();
    expect(chatReadByMe({ userId: 'me', readSeq: 3 }, 'me')).toBeNull();
    expect(chatReadByMe({ chatId: 'c1', userId: 'me', readSeq: '3' }, 'me')).toBeNull();
  });

  it('picks the shown push notices of that chat only', () => {
    const shown = [
      { request: { identifier: 'a', content: { data: { chatId: 'c1' } } } },
      { request: { identifier: 'b', content: { data: { chatId: 'c2' } } } },
      { request: { identifier: 'c', content: { data: null } } },
    ];
    expect(presentedOfChat(shown, 'c1')).toEqual(['a']);
  });
});
