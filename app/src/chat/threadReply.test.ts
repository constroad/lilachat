import { describe, expect, it } from 'vitest';
import { isThreadMediaReply, replyRowOf, threadPhotoMessages } from './threadReply';
import type { ChatMessage } from './useChat';

const sent = (seq: number) => ({ seq });
const pending = { seq: 7, pending: true };

describe('replyRowOf', () => {
  it('finds the reply in the rows as they are now', () => {
    expect(replyRowOf([sent(1), sent(2), sent(3)], 3)).toBe(2);
  });

  it('a reply that left the list has no row: the late scroll asks for nothing (index 6 of 0 to 5, 06/11)', () => {
    // Arrange: seven rows when the thread opened, six when the second pass runs.
    const rows = [1, 2, 3, 4, 5, 6].map(sent);
    // Act and assert
    expect(replyRowOf(rows, 7)).toBe(-1);
  });

  it('a reply still sending is not the one a notice points to', () => {
    expect(replyRowOf([sent(1), pending], 7)).toBe(-1);
  });

  it('with no reply asked there is nothing to find', () => {
    expect(replyRowOf([sent(1)], undefined)).toBe(-1);
  });
});

/** José 13/11: a photo sent as a reply in the thread was drawn as text, and a tap opened nothing. */
describe('threadPhotoMessages', () => {
  const root = { seq: 10, pending: false as const };

  it('the viewer swipes through the root and then the replies, in order', () => {
    // Arrange
    const replies = [{ seq: 11, pending: false as const }, { seq: 12, pending: false as const }];
    // Act
    const messages = threadPhotoMessages(root, replies);
    // Assert
    expect(messages.map((message) => message.seq)).toEqual([10, 11, 12]);
  });

  it('a reply still sending is not in the viewer: it has no seq to open', () => {
    expect(threadPhotoMessages(root, [{ clientKey: 'k1', pending: true as const }]).map((message) => message.seq)).toEqual([10]);
  });

  it('with the root not loaded yet, only the replies', () => {
    expect(threadPhotoMessages(null, [{ seq: 11, pending: false as const }]).map((message) => message.seq)).toEqual([11]);
  });
});

describe('isThreadMediaReply', () => {
  const reply = (fields: Partial<ChatMessage>) => ({ seq: 11, chatId: 'c1', senderId: 'u1', clientKey: 'k11', at: '2026-11-13T21:00:00Z', kind: 'text', ...fields }) as ChatMessage;
  const photo = { mediaId: '6af7b7a5fd904a3272db4eb3', url: 'https://lila.constroad.com/m/1.jpg', thumbUrl: 'https://lila.constroad.com/m/1.thumb.jpg', mime: 'image/jpeg' };

  it('a photo sent as a reply draws as media, not as text', () => {
    expect(isThreadMediaReply(reply({ kind: 'image', media: photo }))).toBe(true);
  });

  it('a voice note or a file also draws as media', () => {
    expect(isThreadMediaReply(reply({ kind: 'audio', media: { mediaId: '6af7b7a5fd904a3272db4eb4', url: 'https://lila.constroad.com/m/2.m4a', mime: 'audio/mp4' } }))).toBe(true);
  });

  it('a sticker keeps its own drawing', () => {
    expect(isThreadMediaReply(reply({ kind: 'sticker', media: photo }))).toBe(false);
  });

  it('a deleted photo reads as a deleted message', () => {
    expect(isThreadMediaReply(reply({ kind: 'image', media: photo, deletedAt: '2026-11-13T21:05:00Z' }))).toBe(false);
  });

  it('a text reply and one still sending stay in the text bubble', () => {
    expect(isThreadMediaReply(reply({ body: 'Listo' }))).toBe(false);
    expect(isThreadMediaReply({ clientKey: 'k12', queuedAt: '2026-11-13T21:00:00Z', pending: true } as never)).toBe(false);
  });
});
