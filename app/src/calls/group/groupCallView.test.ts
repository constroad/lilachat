import { describe, expect, it } from 'vitest';
import { groupCallCaption, ringText, tilesOf } from './groupCallView';

/** Pending 56 (José, 29/10): group calls. */
describe('ringText', () => {
  it('names who started it and whether it is video; a missing name or group still reads well', () => {
    expect(ringText({ chatId: 'g', from: 'a', fromName: 'Ana', video: true }, 'Obra km 12')).toEqual({ title: 'Obra km 12', subtitle: 'Ana inició una videollamada grupal' });
    expect(ringText({ chatId: 'g', from: 'a', fromName: null, video: false }, '')).toEqual({ title: 'Grupo', subtitle: 'Alguien inició una llamada grupal' });
  });
});

describe('tilesOf', () => {
  it('puts me first and the others in the order they joined, with or without media yet', () => {
    // Arrange
    const streams = new Map([['b', 'stream-b']]);
    // Act
    const tiles = tilesOf({ me: 'c', myStream: 'mine', participants: ['a', 'b', 'c'], streams, nameOf: (userId) => `N-${userId}` });
    // Assert
    expect(tiles).toEqual([
      { key: 'c', name: 'Tú', stream: 'mine', mine: true },
      { key: 'a', name: 'N-a', stream: null, mine: false },
      { key: 'b', name: 'N-b', stream: 'stream-b', mine: false },
    ]);
  });
});

describe('groupCallCaption', () => {
  it('says how many and the time, or that it is still connecting', () => {
    expect(groupCallCaption(1, null)).toBe('1 persona · Conectando…');
    expect(groupCallCaption(3, 252)).toBe('3 personas · 04:12');
  });
});
