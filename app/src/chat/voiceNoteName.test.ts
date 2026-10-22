import { describe, expect, it } from 'vitest';
import { voiceNoteFileName } from './voiceNoteName';

/** The name a voice note keeps on the phone (José, 21/10: «carga y luego reproduce; WhatsApp reproduce al toque»). */
describe('voiceNoteFileName', () => {
  it('the storage name of the note, safe for the disk, with its extension', () => {
    expect(voiceNoteFileName('https://lila.constroad.com/files/companies/lilachat/voz/voice-2026-10-21T18:02:11.m4a')).toMatch(/^[a-z0-9]+-voice-2026-10-21T18_02_11\.m4a$/);
  });
  it('without an extension in the URL, m4a (the app records m4a)', () => {
    expect(voiceNoteFileName('https://lila.constroad.com/files/a3f9c1e8?sig=1')).toMatch(/^[a-z0-9]+-a3f9c1e8\.m4a$/);
  });
  it('two notes with the same last segment in different folders do not collide', () => {
    expect(voiceNoteFileName('https://x/a/note.m4a')).not.toBe(voiceNoteFileName('https://x/b/note.m4a'));
  });
  it('nothing usable: no name', () => {
    expect(voiceNoteFileName('')).toBeNull();
  });
});
