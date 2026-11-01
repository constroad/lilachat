import { describe, expect, it } from 'vitest';
import { stickerRowLayout } from './stickerRows.js';

/** Stickers sent in a row show two side by side, like WhatsApp (José, 02/11: «se muestran uno tras otro»). */
const at = (minute: number) => new Date(2026, 10, 2, 10, minute).toISOString();
const sticker = (seq: number, extra: Record<string, unknown> = {}) => ({ seq, senderId: 'ana', kind: 'sticker', at: at(seq), media: { url: `https://x/${seq}.webp` }, ...extra });

describe('stickers side by side', () => {
  it('pairs the stickers one person sent in a row; the odd one stays alone', () => {
    // Act
    const layout = stickerRowLayout([sticker(1), sticker(2), sticker(3)]);
    // Assert
    expect(layout.get(1)).toEqual({ role: 'head', seqs: [1, 2] });
    expect(layout.get(2)).toEqual({ role: 'member', head: 1 });
    expect(layout.has(3)).toBe(false);
  });

  it('four in a row are two pairs', () => {
    const layout = stickerRowLayout([sticker(1), sticker(2), sticker(3), sticker(4)]);
    expect(layout.get(3)).toEqual({ role: 'head', seqs: [3, 4] });
  });

  it('another sender, a text in between or another day cut the run', () => {
    // Arrange
    const otherSender = [sticker(1), sticker(2, { senderId: 'luis' })];
    const textBetween = [sticker(1), { seq: 2, senderId: 'ana', kind: 'text', at: at(2) }, sticker(3)];
    const nextDay = [sticker(1), { ...sticker(2), at: new Date(2026, 10, 3, 10, 0).toISOString() }];
    // Act + Assert
    expect(stickerRowLayout(otherSender).size).toBe(0);
    expect(stickerRowLayout(textBetween).size).toBe(0);
    expect(stickerRowLayout(nextDay).size).toBe(0);
  });

  it('far apart in time they are two moments, not a pair', () => {
    expect(stickerRowLayout([sticker(1), { ...sticker(2), at: at(30) }]).size).toBe(0);
  });

  it('a sticker that quotes, has reactions or a thread, or was deleted, stays alone', () => {
    // Arrange
    const cases = [{ replyToSeq: 9 }, { reacciones: [{ emoji: '👍', userIds: ['luis'] }] }, { hilo: { respuestas: 2 } }, { deletedAt: at(5) }];
    // Act + Assert
    for (const extra of cases) {
      expect(stickerRowLayout([sticker(1), sticker(2, extra)]).size).toBe(0);
      expect(stickerRowLayout([sticker(1, extra), sticker(2)]).size).toBe(0);
    }
  });

  it('the unread divider before the second one keeps them apart, so the divider is still drawn', () => {
    expect(stickerRowLayout([sticker(1), sticker(2)], { dividerSeq: 2 }).size).toBe(0);
  });

  it('a sticker still sending (no seq) or without its file is not paired', () => {
    expect(stickerRowLayout([sticker(1), { senderId: 'ana', kind: 'sticker', at: at(2), media: { url: 'x' } }]).size).toBe(0);
    expect(stickerRowLayout([sticker(1), sticker(2, { media: {} })]).size).toBe(0);
  });
});
