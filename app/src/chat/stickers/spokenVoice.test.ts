import { describe, expect, it } from 'vitest';
import { audioBase64Of, spokenBlocker, spokenFieldsOf } from './spokenVoice';
import { soundSummary, stickerSoundOf, videoStickerUploadOf } from './videoStickerSound';
import { savedSoundUploadOf } from './savedStickerSound';

/** José 27/11: Latin Spanish voices for sound stickers, admins only, only Valeria and Daniel (design sv-01). */
const SPACE = '6a87c797c709c4a21aba3aff';
const spoken = (text: string, voiceId: 'valeria' | 'daniel' = 'valeria') => ({ kind: 'spoken' as const, voiceId, text, spaceId: SPACE });

describe('a voice as the sticker sound on the APK', () => {
  it('is voice:<id> with the phrase and the space as fields', () => {
    expect(stickerSoundOf(spoken(' Hola '))).toEqual({ kind: 'voice', voiceId: 'valeria' });
    expect(spokenFieldsOf(spoken(' Hola '))).toEqual([['voiceText', 'Hola'], ['spaceId', SPACE]]);
    expect(spokenFieldsOf({ kind: 'none' })).toEqual([]);
  });

  it('without a phrase it is not ready, and says why', () => {
    expect(stickerSoundOf(spoken('  '))).toBeNull();
    expect(spokenBlocker(spoken('  '))).toBe('Escribe la frase de la voz (hasta 120 caracteres).');
    expect(spokenBlocker(spoken('Hola'))).toBeNull();
  });

  it('the summary names the voice and the phrase', () => {
    expect(soundSummary(spoken('¡Buen trabajo!', 'daniel'))).toEqual({ title: 'Voz de Daniel', detail: '¡Buen trabajo!' });
    expect(soundSummary(spoken(''))).toEqual({ title: 'Voz de Valeria', detail: 'Falta la frase' });
  });

  it('a video sticker and a saved one carry the phrase and the space', () => {
    const video = { uri: 'file:///v.mp4', name: 'v.mp4', mime: 'video/mp4' };
    const upload = videoStickerUploadOf({ video, trim: { startMs: 0, endMs: 3000 }, choice: spoken('Hola', 'daniel') });
    expect(upload?.fields).toEqual([['startMs', '0'], ['endMs', '3000'], ['sound', 'voice:daniel'], ['voiceText', 'Hola'], ['spaceId', SPACE]]);
    expect(upload?.audio).toBeNull();
    expect(savedSoundUploadOf(null, spoken('Hola'))).toEqual({ audio: null, fields: [['sound', 'voice:valeria'], ['voiceText', 'Hola'], ['spaceId', SPACE]] });
  });
});

describe('audioBase64Of', () => {
  it('turns the audio bytes into base64 for the cache file', () => {
    expect(audioBase64Of(new Uint8Array([0x6d, 0x34, 0x61]).buffer)).toBe('bTRh');
    expect(audioBase64Of(new Uint8Array(0).buffer)).toBe('');
  });
});
