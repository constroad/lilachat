import { describe, expect, it } from 'vitest';
import { CUSTOM_EMOJI_MAX_BYTES, customEmojiKindOf, customEmojiNameFromToken, customEmojiNameOf, customEmojiToken, reactionGlyph } from './customEmojis.js';

/** Pending 19 (José, 20/10 and 23/10): a space's own emojis, like Slack's. */
describe('custom emoji names', () => {
  it('take what a person types: colons, capitals and spaces become the short name', () => {
    expect(customEmojiNameOf(':Casco OK:')).toBe('casco-ok');
    expect(customEmojiNameOf('vamos')).toBe('vamos');
    expect(customEmojiNameOf('a')).toBeNull();
    expect(customEmojiNameOf('x'.repeat(33))).toBeNull();
    expect(customEmojiNameOf('ñandú')).toBeNull();
    expect(customEmojiNameOf(7)).toBeNull();
  });

  it('a reaction with one travels as «:name:», and only that shape reads back', () => {
    expect(customEmojiToken('casco-ok')).toBe(':casco-ok:');
    expect(customEmojiNameFromToken(':casco-ok:')).toBe('casco-ok');
    expect(customEmojiNameFromToken('👍')).toBeNull();
    expect(customEmojiNameFromToken(':Casco:')).toBeNull();
  });
});

describe('custom emoji images', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const gif = Buffer.from('GIF89a....', 'latin1');
  const webp = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBPVP8 ', 'latin1')]);

  it('PNG, GIF and WebP by their first bytes, never by the name the phone gave', () => {
    expect(customEmojiKindOf(png)).toEqual({ mime: 'image/png', animated: false });
    expect(customEmojiKindOf(gif)).toEqual({ mime: 'image/gif', animated: true });
    expect(customEmojiKindOf(webp)).toEqual({ mime: 'image/webp', animated: false });
    expect(customEmojiKindOf(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('up to 256 KB', () => {
    expect(CUSTOM_EMOJI_MAX_BYTES).toBe(256 * 1024);
    expect(customEmojiKindOf(Buffer.concat([png, Buffer.alloc(CUSTOM_EMOJI_MAX_BYTES)]))).toBeNull();
  });
});

describe('reactionGlyph', () => {
  const catalog = new Map([['casco', { url: 'https://x/casco.png' }]]);

  it('draws a plain emoji as text and a known name as its image', () => {
    expect(reactionGlyph('👍', catalog)).toEqual({ kind: 'text', text: '👍' });
    expect(reactionGlyph(':casco:', catalog)).toEqual({ kind: 'image', url: 'https://x/casco.png', name: 'casco' });
  });

  it('an emoji the space took out, or no list yet, reads as its name', () => {
    expect(reactionGlyph(':grua:', catalog)).toEqual({ kind: 'text', text: ':grua:' });
    expect(reactionGlyph(':casco:', undefined)).toEqual({ kind: 'text', text: ':casco:' });
  });
});
