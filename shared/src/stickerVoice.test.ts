import { describe, expect, it } from 'vitest';
import { parseStickerSound, stickerSoundField, stickerSoundLabelOf } from './soundStickers.js';
import { canUseStickerVoice, STICKER_VOICES, stickerVoiceSpaceOf, stickerVoiceFileName, voiceTextOf, MAX_VOICE_TEXT } from './stickerVoice.js';

/** José 27/11: «voces… las de latino español»; «solo admins, y deja solo Valeria y Daniel». */
describe('the sticker voices', () => {
  it('are only Valeria and Daniel', () => {
    expect(STICKER_VOICES.map((voice) => voice.id)).toEqual(['valeria', 'daniel']);
  });

  it('only a space owner or admin can use them', () => {
    expect(canUseStickerVoice('owner')).toBe(true);
    expect(canUseStickerVoice('admin')).toBe(true);
    expect(canUseStickerVoice('member')).toBe(false);
    expect(canUseStickerVoice('guest')).toBe(false);
    expect(canUseStickerVoice(undefined)).toBe(false);
  });
});

describe('voice as a sticker sound', () => {
  it('is a sound choice that goes and comes back through the form', () => {
    // Arrange / Act
    const parsed = parseStickerSound('voice:daniel');
    // Assert
    expect(parsed).toEqual({ kind: 'voice', voiceId: 'daniel' });
    expect(stickerSoundField({ kind: 'voice', voiceId: 'valeria' })).toBe('voice:valeria');
  });

  it('a voice that is not offered is not a sound (Lucía, Mateo or the clone)', () => {
    expect(parseStickerSound('voice:lucia')).toBeNull();
    expect(parseStickerSound('voice:clone_f57d5fd345ae')).toBeNull();
    expect(parseStickerSound('voice:')).toBeNull();
  });
});

describe('voiceTextOf', () => {
  it('keeps a trimmed phrase of up to 120 characters', () => {
    expect(voiceTextOf('  ¡Vaciado listo!  ')).toBe('¡Vaciado listo!');
    expect(voiceTextOf('a'.repeat(MAX_VOICE_TEXT))).toHaveLength(MAX_VOICE_TEXT);
  });

  it('refuses an empty, too long or non-text phrase', () => {
    expect(voiceTextOf('   ')).toBeNull();
    expect(voiceTextOf('a'.repeat(MAX_VOICE_TEXT + 1))).toBeNull();
    expect(voiceTextOf(undefined)).toBeNull();
    expect(voiceTextOf(42)).toBeNull();
  });
});

describe('a saved voice sound', () => {
  it('the sticker keeps which voice it is, and is named by it (the media server renames files: E2E 27/11)', () => {
    // Arrange
    const sticker = { audioUrl: 'https://lilachat.constroad.com/files/a/audio-2026-11-27T14-50-00_ab12.m4a', soundVoiceId: 'valeria' as const };
    // Act / Assert
    expect(stickerSoundLabelOf(sticker)).toBe('Voz de Valeria');
    expect(stickerVoiceFileName('daniel')).toBe('sticker-voz-daniel.m4a');
  });

  it('a recorded sound, or a voice field without sound, is not a voice', () => {
    expect(stickerSoundLabelOf({ audioUrl: 'https://x/files/a/sticker-sonido.m4a' })).toBe('Sonido propio');
    expect(stickerSoundLabelOf({ soundVoiceId: 'daniel' })).toBeNull();
  });
});

/** José 27/11: «aún no veo el generar voz» — in Personal or a direct chat there is no open space. */
describe('stickerVoiceSpaceOf', () => {
  const spaces = [
    { id: 'member-space', role: 'member' as const },
    { id: 'admin-space', role: 'admin' as const },
    { id: 'owner-space', role: 'owner' as const },
  ];
  it('uses the open space when I manage it', () => {
    expect(stickerVoiceSpaceOf('owner-space', spaces)).toBe('owner-space');
  });
  it('with no open space, or one I only belong to, falls back to the first space I manage', () => {
    expect(stickerVoiceSpaceOf(null, spaces)).toBe('admin-space');
    expect(stickerVoiceSpaceOf('member-space', spaces)).toBe('admin-space');
  });
  it('is null for someone who manages no space, or before the spaces load', () => {
    expect(stickerVoiceSpaceOf(null, [{ id: 'member-space', role: 'member' }])).toBeNull();
    expect(stickerVoiceSpaceOf('x', null)).toBeNull();
  });
});
