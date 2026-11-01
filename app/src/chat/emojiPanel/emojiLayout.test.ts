import { describe, expect, it } from 'vitest';
import { emojiLayout, recentEmojis, sectionAtOffset } from './emojiLayout';

/** Every category in ONE scroll, like WhatsApp (José, 02/11): the bar jumps to a section and follows the scroll. */
const sections = [
  { key: 'recently_used', title: 'Recientes', emojis: ['😂', '❤️'] },
  { key: 'smileys_emotion', title: 'Caras', emojis: ['😀', '😃', '😄', '😁', '😆'] },
  { key: 'flags', title: 'Banderas', emojis: [] },
  { key: 'animals_nature', title: 'Animales', emojis: ['🐶', '🐱', '🐭'] },
];

describe('one scroll with every category', () => {
  it('a header per category, then its emojis in rows of the given columns; an empty category is left out', () => {
    // Act
    const layout = emojiLayout(sections, { columns: 2, rowHeight: 40, headerHeight: 30 });
    // Assert
    expect(layout.rows.map((row) => (row.kind === 'header' ? row.title : row.emojis.join('')))).toEqual(['Recientes', '😂❤️', 'Caras', '😀😃', '😄😁', '😆', 'Animales', '🐶🐱', '🐭']);
    expect(layout.sections.map((section) => section.key)).toEqual(['recently_used', 'smileys_emotion', 'animals_nature']);
  });

  it('each row knows where it starts, so the list jumps without measuring', () => {
    const layout = emojiLayout(sections, { columns: 2, rowHeight: 40, headerHeight: 30 });
    expect(layout.rows.slice(0, 4).map((row) => [row.offset, row.height])).toEqual([[0, 30], [30, 40], [70, 30], [100, 40]]);
    expect(layout.sections[1]).toEqual({ key: 'smileys_emotion', offset: 70 });
  });

  it('the bar marks the category under the top of the list', () => {
    // Arrange
    const { sections: starts } = emojiLayout(sections, { columns: 2, rowHeight: 40, headerHeight: 30 });
    // Act + Assert
    expect(sectionAtOffset(starts, 0)).toBe('recently_used');
    expect(sectionAtOffset(starts, 69)).toBe('recently_used');
    expect(sectionAtOffset(starts, 70)).toBe('smileys_emotion');
    expect(sectionAtOffset(starts, 99_999)).toBe('animals_nature');
    expect(sectionAtOffset([], 10)).toBeNull();
  });
});

describe('recent emojis', () => {
  it('reads what was saved before (objects or plain emojis), without repeats and capped', () => {
    expect(recentEmojis([{ emoji: '😂' }, '❤️', { emoji: '😂' }, { name: 'x' }, 7], 10)).toEqual(['😂', '❤️']);
    expect(recentEmojis(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });

  it('anything that is not a list is no recents', () => {
    expect(recentEmojis(null, 10)).toEqual([]);
    expect(recentEmojis({ emoji: '😂' }, 10)).toEqual([]);
  });
});
