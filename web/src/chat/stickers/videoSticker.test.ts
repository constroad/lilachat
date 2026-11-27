import { describe, expect, it } from 'vitest';
import { MAX_STICKER_AUDIO_BYTES, MAX_STICKER_VIDEO_BYTES, VIDEO_STICKER_MAX_MS, VIDEO_STICKER_MIN_MS } from '@lilachat/shared';
import { audioFileProblem, clipSeconds, clipTime, HOLD_TO_RECORD_MS, initialTrim, lostItsSound, moveTrim, msAtStrip, releaseStopsRecording, resizeTrimEnd, resizeTrimStart, soundRequestOf, stripTicks, trimLengthMs, videoFileProblem, withMediaType } from './videoSticker';

const fileOf = (name: string, type: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type });
const heavy = (name: string, type: string, size: number) => {
  const file = fileOf(name, type);
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/** José 26/11 (design ss-04): the clip is up to 6 s and at least half a second. */
describe('the trim window of a video sticker', () => {
  it('a long video starts with its first 6 seconds', () => {
    expect(initialTrim(20_000)).toEqual({ startMs: 0, endMs: VIDEO_STICKER_MAX_MS });
  });

  it('a short video keeps all of it', () => {
    expect(initialTrim(3_200)).toEqual({ startMs: 0, endMs: 3_200 });
  });

  it('a blink, an unknown or an endless duration cannot make a sticker', () => {
    expect(initialTrim(VIDEO_STICKER_MIN_MS - 1)).toBeNull();
    expect(initialTrim(Number.NaN)).toBeNull();
    expect(initialTrim(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('a point of the strip is a moment of the video, clamped to its ends', () => {
    expect(msAtStrip(0.5, 20_000)).toBe(10_000);
    expect(msAtStrip(-0.2, 20_000)).toBe(0);
    expect(msAtStrip(1.4, 20_000)).toBe(20_000);
  });

  it('moving the window keeps its length and stays inside the video', () => {
    const trim = { startMs: 0, endMs: 6_000 };
    expect(moveTrim(trim, 12_000, 20_000)).toEqual({ startMs: 12_000, endMs: 18_000 });
    expect(moveTrim(trim, 17_000, 20_000)).toEqual({ startMs: 14_000, endMs: 20_000 });
    expect(moveTrim(trim, -500, 20_000)).toEqual({ startMs: 0, endMs: 6_000 });
  });

  it('the start handle never makes it longer than 6 s nor shorter than half a second', () => {
    const trim = { startMs: 10_000, endMs: 14_000 };
    expect(resizeTrimStart(trim, 12_000, 20_000)).toEqual({ startMs: 12_000, endMs: 14_000 });
    expect(resizeTrimStart(trim, 2_000, 20_000)).toEqual({ startMs: 8_000, endMs: 14_000 });
    expect(resizeTrimStart(trim, 13_900, 20_000)).toEqual({ startMs: 13_500, endMs: 14_000 });
    expect(resizeTrimStart({ startMs: 1_000, endMs: 3_000 }, -400, 20_000)).toEqual({ startMs: 0, endMs: 3_000 });
  });

  it('the end handle has the same limits and stops at the end of the video', () => {
    const trim = { startMs: 10_000, endMs: 14_000 };
    expect(resizeTrimEnd(trim, 15_000, 20_000)).toEqual({ startMs: 10_000, endMs: 15_000 });
    expect(resizeTrimEnd(trim, 19_000, 20_000)).toEqual({ startMs: 10_000, endMs: 16_000 });
    expect(resizeTrimEnd(trim, 10_100, 20_000)).toEqual({ startMs: 10_000, endMs: 10_500 });
    expect(resizeTrimEnd({ startMs: 17_000, endMs: 19_000 }, 25_000, 20_000)).toEqual({ startMs: 17_000, endMs: 20_000 });
  });

  it('the length is what the sticker lasts', () => {
    expect(trimLengthMs({ startMs: 12_000, endMs: 18_000 })).toBe(6_000);
  });
});

describe('the times the modal shows', () => {
  it('minutes and seconds, like the strip of the design', () => {
    expect(clipTime(12_000)).toBe('0:12');
    expect(clipTime(65_400)).toBe('1:05');
    expect(clipTime(0)).toBe('0:00');
  });

  it('the length with one decimal', () => {
    expect(clipSeconds(6_000)).toBe('6.0');
    expect(clipSeconds(2_450)).toBe('2.5');
  });

  it('the strip ticks spread over the video, first and last included', () => {
    expect(stripTicks(20_000, 5)).toEqual([0, 5_000, 10_000, 15_000, 20_000]);
    expect(stripTicks(0, 5)).toEqual([]);
  });
});

describe('the files the person picks', () => {
  it('a video of up to 60 MB is fine; another file or a heavier one is not', () => {
    expect(videoFileProblem(fileOf('obra.mp4', 'video/mp4'))).toBeNull();
    expect(videoFileProblem(fileOf('obra.mov', ''))).toBeNull();
    expect(videoFileProblem(fileOf('foto.jpg', 'image/jpeg'))).toBe('Elige un video.');
    expect(videoFileProblem(heavy('largo.mp4', 'video/mp4', MAX_STICKER_VIDEO_BYTES + 1))).toBe('Ese video pesa demasiado (máximo 60 MB).');
  });

  it('an MP3, M4A or WAV of up to 4 MB is fine', () => {
    expect(audioFileProblem(fileOf('risa.mp3', 'audio/mpeg'))).toBeNull();
    expect(audioFileProblem(fileOf('voz.m4a', ''))).toBeNull();
    expect(audioFileProblem(fileOf('bocina.wav', 'audio/wav'))).toBeNull();
    expect(audioFileProblem(fileOf('tema.flac', 'audio/flac'))).toBe('Elige un audio MP3, M4A o WAV.');
    expect(audioFileProblem(heavy('largo.mp3', 'audio/mpeg', MAX_STICKER_AUDIO_BYTES + 1))).toBe('Ese audio pesa demasiado (máximo 4 MB).');
  });

  it('a file the browser left without type gets one from its extension (the server reads the type)', () => {
    expect(withMediaType(fileOf('voz.m4a', '')).type).toBe('audio/mp4');
    expect(withMediaType(fileOf('obra.mov', '')).type).toBe('video/quicktime');
    const typed = fileOf('obra.mp4', 'video/mp4');
    expect(withMediaType(typed)).toBe(typed);
  });
});

describe('the sound the modal sends', () => {
  const voice = new Blob(['webm'], { type: 'audio/webm' });
  const upload = fileOf('risa.mp3', 'audio/mpeg');

  it('the original, a preset or none travel without an audio', () => {
    expect(soundRequestOf({ kind: 'original' }, voice, upload)).toEqual({ sound: { kind: 'original' }, audio: null });
    expect(soundRequestOf({ kind: 'preset', presetId: 'bocina' }, null, null)).toEqual({ sound: { kind: 'preset', presetId: 'bocina' }, audio: null });
    expect(soundRequestOf({ kind: 'none' }, voice, null)).toEqual({ sound: { kind: 'none' }, audio: null });
  });

  it('the recorded voice and the uploaded audio go as a file', () => {
    expect(soundRequestOf({ kind: 'voice' }, voice, upload)).toEqual({ sound: { kind: 'file' }, audio: voice });
    expect(soundRequestOf({ kind: 'upload' }, voice, upload)).toEqual({ sound: { kind: 'file' }, audio: upload });
  });

  it('a voice not recorded yet, or an audio not chosen, says what is missing', () => {
    expect(soundRequestOf({ kind: 'voice' }, null, upload)).toEqual({ problem: 'Graba tu voz primero, o elige otro sonido.' });
    expect(soundRequestOf({ kind: 'upload' }, voice, null)).toEqual({ problem: 'Elige un audio, o elige otro sonido.' });
  });

  it('a silent video with «Sonido original» is saved without sound, and the person is told', () => {
    expect(lostItsSound({ kind: 'original' }, { audioUrl: undefined })).toBe(true);
    expect(lostItsSound({ kind: 'original' }, { audioUrl: 'https://storage.test/s.m4a' })).toBe(false);
    expect(lostItsSound({ kind: 'none' }, { audioUrl: undefined })).toBe(false);
  });
});

describe('«Grabar tu voz»: hold or tap', () => {
  it('holding the button records while pressed: letting go stops', () => {
    expect(releaseStopsRecording(HOLD_TO_RECORD_MS + 200)).toBe(true);
  });

  it('a quick tap starts it, and it keeps recording until another tap', () => {
    expect(releaseStopsRecording(HOLD_TO_RECORD_MS - 100)).toBe(false);
  });
});
