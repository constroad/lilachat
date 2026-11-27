import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewStickerVoice, setStickerSound, videoStickerForm } from './stickersApi';
import { savedSoundRequestOf, soundRequestOf } from './videoSticker';

/** José 27/11: Latin Spanish voices for sound stickers, admins only, only Valeria and Daniel. */
const SPACE = '6a87c797c709c4a21aba3aff';
const spoken = (text: string) => ({ kind: 'spoken' as const, voiceId: 'valeria' as const, text, spaceId: SPACE });

describe('a voice as the sticker sound', () => {
  it('goes to the server as voice:<id> with its phrase and space', () => {
    // Act
    const request = soundRequestOf(spoken('  ¡Vaciado listo!  '), null, null);
    // Assert
    expect(request).toEqual({ sound: { kind: 'voice', voiceId: 'valeria' }, audio: null, spoken: { text: '¡Vaciado listo!', spaceId: SPACE } });
  });

  it('without a phrase, or with one too long, it asks for it', () => {
    expect(soundRequestOf(spoken('   '), null, null)).toEqual({ problem: 'Escribe la frase de la voz (hasta 120 caracteres).' });
    expect(savedSoundRequestOf(spoken('a'.repeat(121)), null, null)).toEqual({ problem: 'Escribe la frase de la voz (hasta 120 caracteres).' });
  });

  it('the video form carries the phrase and the space', () => {
    const form = videoStickerForm({ video: new File(['mp4'], 'a.mp4', { type: 'video/mp4' }), trim: { startMs: 0, endMs: 3000 }, sound: { kind: 'voice', voiceId: 'daniel' }, spoken: { text: 'Hola', spaceId: SPACE } });
    expect(form.get('sound')).toBe('voice:daniel');
    expect(form.get('voiceText')).toBe('Hola');
    expect(form.get('spaceId')).toBe(SPACE);
    expect(form.get('audio')).toBeNull();
  });
});

describe('talking to the server', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('the sound of a saved sticker carries the phrase and the space', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sticker: { id: 's1' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Act
    await setStickerSound('jwt', 's1', { sound: { kind: 'voice', voiceId: 'valeria' }, audio: null, spoken: { text: 'Hola', spaceId: SPACE } });
    // Assert
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(form.get('sound')).toBe('voice:valeria');
    expect(form.get('voiceText')).toBe('Hola');
    expect(form.get('spaceId')).toBe(SPACE);
  });

  it('«Escuchar» gets the audio, or the server’s refusal in its words', async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('m4a', { status: 200, headers: { 'Content-Type': 'audio/mp4' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'La voz no está disponible ahora. Inténtalo más tarde.' }), { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    // Act
    const heard = await previewStickerVoice('jwt', { voiceId: 'daniel', text: 'Hola', spaceId: SPACE });
    const refused = await previewStickerVoice('jwt', { voiceId: 'daniel', text: 'Hola', spaceId: SPACE });
    // Assert
    expect(heard.ok && heard.audio.size).toBe(3);
    expect(refused).toEqual({ ok: false, message: 'La voz no está disponible ahora. Inténtalo más tarde.' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/stickers/voice/preview');
    expect(JSON.parse(String(init.body))).toEqual({ voice: 'daniel', text: 'Hola', spaceId: SPACE });
  });
});
