import { describe, expect, it } from 'vitest';
import { seasonOf } from './winkSeasons.js';
import { winkPanelGroups } from './winks.js';

/** Noon in Lima. */
const lima = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 17));

describe('seasonal winks (pending 73)', () => {
  it('knows the season in Lima, also across the new year', () => {
    // Act / Assert
    expect(seasonOf(lima(2026, 10, 22))?.season).toBe('halloween');
    expect(seasonOf(lima(2026, 11, 2))?.season).toBe('halloween');
    expect(seasonOf(lima(2026, 11, 3))).toBeNull();
    expect(seasonOf(lima(2026, 12, 24))?.season).toBe('christmas');
    expect(seasonOf(lima(2026, 12, 31))?.season).toBe('newyear');
    expect(seasonOf(lima(2027, 1, 5))?.season).toBe('newyear');
    expect(seasonOf(lima(2027, 7, 28))?.season).toBe('patrias');
  });

  it('the panel opens with the season and hides it out of season', () => {
    // Act
    const october = winkPanelGroups(lima(2026, 10, 22));
    const march = winkPanelGroups(lima(2027, 3, 10));
    // Assert
    expect(october[0]?.title).toBe('Halloween');
    expect(october[0]?.winks.length).toBeGreaterThanOrEqual(5);
    expect(march.map((group) => group.title)).toEqual(['Personajes', 'Obra y pistas', 'Emojis']);
    expect(march.flatMap((group) => group.winks).some((wink) => wink.season)).toBe(false);
  });

  it('in December Christmas goes first, and Halloween is no longer offered', () => {
    // Act
    const december = winkPanelGroups(lima(2026, 12, 10));
    const offered = december.flatMap((group) => group.winks);
    // Assert
    expect(december[0]?.title).toBe('Navidad');
    expect(december[0]?.winks.map((wink) => wink.id)).toEqual(['santa', 'elf', 'reindeer', 'snowman', 'secret-santa']);
    expect(offered.some((wink) => wink.season === 'halloween')).toBe(false);
  });
});
