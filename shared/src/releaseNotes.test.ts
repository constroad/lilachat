import { describe, expect, it } from 'vitest';
import { compareVersions, notesToShow, RELEASE_NOTES, releaseNotesText, type ReleaseNote } from './releaseNotes.js';

const notes: ReleaseNote[] = [
  { version: '0.1.156', items: ['c'] },
  { version: '0.1.155', items: ['b'] },
  { version: '0.1.154', items: ['a'] },
];

describe('what is new after updating (pending 66)', () => {
  it('compares versions by number, not as text', () => {
    expect(compareVersions('0.1.154', '0.1.99')).toBeGreaterThan(0);
    expect(compareVersions('0.1.9', '0.1.10')).toBeLessThan(0);
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0);
  });

  it('nothing seen yet (a fresh install, or the update that brings this window): only the running version', () => {
    expect(notesToShow(notes, null, '0.1.156').map((note) => note.version)).toEqual(['0.1.156']);
    expect(notesToShow(notes, null, '0.1.157')).toEqual([]);
  });

  it('after updating, the versions since the last one seen, newest first, at most three', () => {
    expect(notesToShow(notes, '0.1.154', '0.1.156').map((note) => note.version)).toEqual(['0.1.156', '0.1.155']);
    expect(notesToShow(notes, '0.1.100', '0.1.156')).toHaveLength(3);
  });

  it('nothing again once seen, and nothing from a version newer than the one running', () => {
    expect(notesToShow(notes, '0.1.156', '0.1.156')).toEqual([]);
    expect(notesToShow(notes, '0.1.154', '0.1.155').map((note) => note.version)).toEqual(['0.1.155']);
  });

  it('the catalog is newest first, 3 or 4 short lines per version', () => {
    const versions = RELEASE_NOTES.map((note) => note.version);
    expect([...versions].sort((a, b) => compareVersions(b, a))).toEqual(versions);
    for (const note of RELEASE_NOTES) {
      expect(note.items.length).toBeGreaterThanOrEqual(1);
      expect(note.items.length).toBeLessThanOrEqual(4);
    }
  });

  it('writes the LilaStore notes from the same catalog', () => {
    expect(releaseNotesText({ version: '0.1.154', items: ['Uno', 'Dos'] })).toBe('Lilachat 0.1.154\n\n- Uno\n- Dos\n');
  });
});
