import { describe, expect, it } from 'vitest';
import { initialSavedChoice, savedSoundUploadOf } from './savedStickerSound';

const clip = { uri: 'file:///voz.m4a', name: 'voz.m4a', mime: 'audio/m4a', bytes: 40_000 };

/** José 27/11: «ya tengo un sticker en mis favoritos… quiero agregarle audio sin volver a buscar el GIF». */
describe('initialSavedChoice', () => {
  it('opens on its own preset; with none or a sound of the person, nothing is chosen', () => {
    expect(initialSavedChoice({ audioUrl: 'https://x/sonidos/wink-clap.mp3' })).toEqual({ kind: 'preset', presetId: 'aplausos' });
    expect(initialSavedChoice({ audioUrl: 'https://x/files/sticker-sonido.m4a' })).toBeNull();
    expect(initialSavedChoice({})).toBeNull();
  });
});

describe('savedSoundUploadOf', () => {
  it('a preset goes as its field, a voice as the audio file', () => {
    expect(savedSoundUploadOf(null, { kind: 'preset', presetId: 'risa' })).toEqual({ audio: null, fields: [['sound', 'preset:risa']] });
    expect(savedSoundUploadOf(null, { kind: 'voice', clip })).toEqual({ audio: clip, fields: [['sound', 'file']] });
    expect(savedSoundUploadOf({ kind: 'preset', presetId: 'risa' }, { kind: 'none' })).toEqual({ audio: null, fields: [['sound', 'none']] });
  });

  it('nothing changed, nothing chosen, a voice not yet recorded or «original» send nothing', () => {
    expect(savedSoundUploadOf({ kind: 'preset', presetId: 'risa' }, { kind: 'preset', presetId: 'risa' })).toBeNull();
    expect(savedSoundUploadOf(null, null)).toBeNull();
    expect(savedSoundUploadOf(null, { kind: 'voice', clip: null })).toBeNull();
    expect(savedSoundUploadOf(null, { kind: 'original' })).toBeNull();
  });
});
