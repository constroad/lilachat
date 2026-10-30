import { describe, expect, it } from 'vitest';
import { insertShortcodeEmoji, loadEmojiNames, parseEmojiNames, searchEmojis, shortcodeAt } from './emojiShortcode.js';

/** José 30/10: typing «:hug» should offer the matching emojis, like WhatsApp. */
const table = parseEmojiNames('😀:face grin happy cara feliz|🤗:hug face hugging abrazo|🫂:hug people hugging personas abrazandose|👐:hug hand open hands manos');

describe('shortcodeAt', () => {
  it('finds «:word» right before the caret, after a space or at the start, from two letters', () => {
    expect(shortcodeAt(':hug', 4)).toEqual({ start: 0, query: 'hug' });
    expect(shortcodeAt('hola :abra', 10)).toEqual({ start: 5, query: 'abra' });
    expect(shortcodeAt('hola :h', 7)).toBeNull();
    expect(shortcodeAt('a las 10:30', 11)).toBeNull();
    expect(shortcodeAt('hola :hug amigo', 15)).toBeNull();
    expect(shortcodeAt('hola :hug amigo', 9)).toEqual({ start: 5, query: 'hug' });
  });
});

describe('searchEmojis', () => {
  it('exact word first, then a word that starts with it; accents and case do not matter', () => {
    expect(searchEmojis(table, 'hug')).toEqual(['🤗', '🫂', '👐']);
    expect(searchEmojis(table, 'ABRA')).toEqual(['🤗', '🫂']);
    expect(searchEmojis(table, 'abrazándose')).toEqual(['🫂']);
    expect(searchEmojis(table, 'zzz')).toEqual([]);
    expect(searchEmojis(table, 'hug', 2)).toHaveLength(2);
  });

  it('the real table has the hug face for «hug» and for «abrazo»', async () => {
    const real = await loadEmojiNames();
    expect(real.length).toBeGreaterThan(1500);
    expect(searchEmojis(real, 'hug')).toContain('🤗');
    expect(searchEmojis(real, 'abrazo')[0]).toBeDefined();
  });
});

describe('insertShortcodeEmoji', () => {
  it('replaces «:hug» with the emoji and a space, and puts the caret after it', () => {
    expect(insertShortcodeEmoji('hola :hug', { start: 5, query: 'hug' }, 9, '🤗')).toEqual({ text: 'hola 🤗 ', caret: 8 });
    expect(insertShortcodeEmoji(':hug y más', { start: 0, query: 'hug' }, 4, '🤗')).toEqual({ text: '🤗  y más', caret: 3 });
  });
});
