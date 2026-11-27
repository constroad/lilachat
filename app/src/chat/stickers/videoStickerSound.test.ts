import { describe, expect, it } from 'vitest';
import { audioClipOf, galleryVideoRefusal, pickedAudioRefusal, pickedVideoOf, savedVideoStickerNotice, soundSummary, stickerSoundOf, videoStickerBlocker, videoStickerFields, type AudioClip } from './videoStickerSound';

const clip: AudioClip = { uri: 'file:///voz.m4a', name: 'voz.m4a', mime: 'audio/m4a', bytes: 40_000 };
const video = { uri: 'file:///v.mp4', name: 'v.mp4', mime: 'video/mp4', bytes: 5_000_000 };
const trim = { startMs: 12_000, endMs: 18_000 };

/** José 26/11 (design ss-02): original, a voice, an audio of the phone, one of ours, or none. */
describe('stickerSoundOf', () => {
  it('sends a recorded or uploaded sound as a file, only once there is one', () => {
    expect(stickerSoundOf({ kind: 'voice', clip })).toEqual({ kind: 'file' });
    expect(stickerSoundOf({ kind: 'upload', clip })).toEqual({ kind: 'file' });
    expect(stickerSoundOf({ kind: 'voice', clip: null })).toBeNull();
  });

  it('passes the other choices as they are', () => {
    expect(stickerSoundOf({ kind: 'original' })).toEqual({ kind: 'original' });
    expect(stickerSoundOf({ kind: 'preset', presetId: 'risa' })).toEqual({ kind: 'preset', presetId: 'risa' });
    expect(stickerSoundOf({ kind: 'none' })).toEqual({ kind: 'none' });
  });

  it('attaches the audio part only for a file sound', () => {
    expect(audioClipOf({ kind: 'upload', clip })).toBe(clip);
    expect(audioClipOf({ kind: 'original' })).toBeNull();
  });
});

describe('videoStickerFields', () => {
  it('builds the window and the sound field the server parses', () => {
    expect(videoStickerFields(trim, { kind: 'preset', presetId: 'aplausos' })).toEqual([
      ['startMs', '12000'],
      ['endMs', '18000'],
      ['sound', 'preset:aplausos'],
    ]);
    expect(videoStickerFields({ startMs: 0.4, endMs: 2_999.6 }, { kind: 'file' })).toEqual([
      ['startMs', '0'],
      ['endMs', '3000'],
      ['sound', 'file'],
    ]);
  });
});

describe('videoStickerBlocker', () => {
  it('lets a complete sticker go', () => {
    expect(videoStickerBlocker({ video, trim, choice: { kind: 'original' } })).toBeNull();
    expect(videoStickerBlocker({ video, trim, choice: { kind: 'voice', clip } })).toBeNull();
  });

  it('stops a video heavier than 60 MB before uploading it', () => {
    expect(videoStickerBlocker({ video: { ...video, bytes: 61 * 1024 * 1024 }, trim, choice: { kind: 'none' } })).toBe('Ese video pesa demasiado (máximo 60 MB).');
  });

  it('asks for the missing voice or audio', () => {
    expect(videoStickerBlocker({ video, trim, choice: { kind: 'voice', clip: null } })).toBe('Graba tu voz o elige otro sonido.');
    expect(videoStickerBlocker({ video, trim, choice: { kind: 'upload', clip: null } })).toBe('Elige un audio del teléfono o elige otro sonido.');
  });

  it('refuses a window too short and an audio heavier than 4 MB', () => {
    expect(videoStickerBlocker({ video, trim: { startMs: 1_000, endMs: 1_200 }, choice: { kind: 'none' } })).toBe('Elige un tramo de medio segundo a 6 segundos.');
    expect(videoStickerBlocker({ video, trim, choice: { kind: 'upload', clip: { ...clip, bytes: 5 * 1024 * 1024 } } })).toBe('Ese audio pesa demasiado (máximo 4 MB).');
  });
});

describe('pickedAudioRefusal', () => {
  it('takes an audio under 4 MB and refuses anything else', () => {
    expect(pickedAudioRefusal({ mimeType: 'audio/mpeg', size: 300_000 })).toBeNull();
    expect(pickedAudioRefusal({ mimeType: 'image/png', size: 300 })).toBe('Elige un archivo de audio.');
    expect(pickedAudioRefusal({ mimeType: null })).toBe('Elige un archivo de audio.');
    expect(pickedAudioRefusal({ mimeType: 'audio/mpeg', size: 4 * 1024 * 1024 + 1 })).toBe('Ese audio pesa demasiado (máximo 4 MB).');
  });
});

describe('savedVideoStickerNotice', () => {
  it('says when the video had no sound', () => {
    expect(savedVideoStickerNotice({ kind: 'original' }, {})).toBe('El video no tenía sonido: el sticker quedó sin sonido.');
    expect(savedVideoStickerNotice({ kind: 'original' }, { audioUrl: 'https://x/a.m4a' })).toBe('Sticker guardado en Mis stickers');
    expect(savedVideoStickerNotice({ kind: 'none' }, {})).toBe('Sticker guardado en Mis stickers');
  });
});

describe('soundSummary', () => {
  it('names each choice in the sound row', () => {
    expect(soundSummary({ kind: 'original' }).title).toBe('Sonido original');
    expect(soundSummary({ kind: 'preset', presetId: 'risa' })).toEqual({ title: 'Risa', detail: 'Sonido de Lilachat' });
    expect(soundSummary({ kind: 'upload', clip })).toEqual({ title: 'Audio del teléfono', detail: 'voz.m4a' });
    expect(soundSummary({ kind: 'voice', clip: null }).detail).toBe('Falta grabarla');
  });
});

describe('pickedVideoOf', () => {
  it('fills the type and the name the picker did not know', () => {
    expect(pickedVideoOf({ uri: 'file:///a', fileName: null, mimeType: null, fileSize: 10 })).toEqual({ uri: 'file:///a', name: 'sticker-video.mp4', mime: 'video/mp4', bytes: 10 });
    expect(pickedVideoOf({ uri: 'file:///b', fileName: 'b.mov', mimeType: 'video/quicktime' })).toEqual({ uri: 'file:///b', name: 'b.mov', mime: 'video/quicktime', bytes: undefined });
  });
});

describe('galleryVideoRefusal', () => {
  it('refuses a video too heavy or too short, and lets an unknown length through', () => {
    expect(galleryVideoRefusal({ fileSize: 70 * 1024 * 1024, duration: 9_000 })).toBe('Ese video pesa demasiado (máximo 60 MB).');
    expect(galleryVideoRefusal({ fileSize: 1_000, duration: 300 })).toBe('Ese video es muy corto: elige uno de medio segundo o más.');
    expect(galleryVideoRefusal({ fileSize: null, duration: null })).toBeNull();
    expect(galleryVideoRefusal({ fileSize: 1_000, duration: 12_000 })).toBeNull();
  });
});
