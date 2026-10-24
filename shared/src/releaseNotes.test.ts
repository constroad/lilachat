import { describe, expect, it } from 'vitest';
import { audienceOfNotes, compareVersions, isAudienceLine, notesToShow, RELEASE_NOTES, releaseNotesText, updateMatters, type ReleaseNote } from './releaseNotes.js';

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

describe('who a version is for (José, 24/10: a personal-only user should not update for a company-mode change, and vice versa)', () => {
  it('the published notes carry the audience line, and the app reads it back; old notes are for everyone', () => {
    // Arrange
    const spaces = releaseNotesText({ version: '0.1.167', audience: 'spaces', items: ['Ajustes del espacio abajo.'] });
    const chatsOnlyNotes = releaseNotesText({ version: '0.1.168', audience: 'personal', items: ['Stickers nuevos.'] });
    // Act + Assert
    expect(spaces).toBe('Lilachat 0.1.167\nPara: modo empresa\n\n- Ajustes del espacio abajo.\n');
    expect(audienceOfNotes(spaces)).toBe('spaces');
    expect(audienceOfNotes(chatsOnlyNotes)).toBe('personal');
    expect(audienceOfNotes('Lilachat 0.1.166\n\n- Clima por horas.\n')).toBe('all');
    expect(releaseNotesText({ version: '0.1.169', audience: 'all', items: ['x'] })).toBe('Lilachat 0.1.169\n\n- x\n');
    expect([isAudienceLine(' Para: modo empresa '), isAudienceLine('- Para: modo empresa')]).toEqual([true, false]);
  });

  it('notifies only who it matters to: company mode to space members, personal to who has personal chats, «all» to everyone', () => {
    const chatsUser = { spaces: false, personal: true };
    const onlySpaces = { spaces: true, personal: false };
    expect(updateMatters(['spaces'], chatsUser)).toBe(false);
    expect(updateMatters(['personal'], onlySpaces)).toBe(false);
    expect(updateMatters(['spaces'], onlySpaces)).toBe(true);
    expect(updateMatters(['spaces', 'personal'], chatsUser)).toBe(true);
    expect(updateMatters(['all'], { spaces: false, personal: false })).toBe(true);
  });

  it('when what the person uses is not known yet, or the notes did not come, it notifies', () => {
    expect(updateMatters(['spaces'], null)).toBe(true);
    expect(updateMatters([], { spaces: false, personal: true })).toBe(true);
  });
});
