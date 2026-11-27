import { describe, expect, it } from 'vitest';
import { BOT_AUDIO_MAX_MS, BOT_UPLOAD_MAX_BYTES, botUploadKindOf, uploadIdsOf } from './botUploads.js';
import { validateBotPost } from './bots.js';

/** José 17/11: a prospect's KML, photo or PDF reaches the channel through agentes' upload. */
describe('botUploadKindOf', () => {
  it('takes photos, videos and the documents of a quote', () => {
    expect(botUploadKindOf('image/jpeg', 'foto.jpg')).toBe('image');
    expect(botUploadKindOf('video/mp4', 'v.mp4')).toBe('video');
    expect(botUploadKindOf('application/pdf', 'metrados.pdf')).toBe('file');
    expect(botUploadKindOf('application/octet-stream', 'METRADOS 161126.kml')).toBe('file');
    expect(botUploadKindOf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'tabla.xlsx')).toBe('file');
    expect(botUploadKindOf('', 'plano.DWG')).toBe('file');
  });

  it('takes a WhatsApp voice note too (agentes 23/11): ogg/opus, mp4 and mpeg audio', () => {
    expect(botUploadKindOf('audio/ogg; codecs=opus', 'nota.ogg')).toBe('audio');
    expect(botUploadKindOf('audio/mp4', 'nota.m4a')).toBe('audio');
    expect(botUploadKindOf('audio/mpeg', 'nota.mp3')).toBe('audio');
  });

  it('refuses what is not on the list', () => {
    expect(botUploadKindOf('application/x-msdownload', 'virus.exe')).toBeNull();
    expect(botUploadKindOf('application/octet-stream', 'sin-extension')).toBeNull();
    expect(botUploadKindOf('text/html', 'pagina.html')).toBeNull();
  });

  it('the limit is 16 MB', () => {
    expect(BOT_UPLOAD_MAX_BYTES).toBe(16 * 1024 * 1024);
  });
});

describe('files sent by id', () => {
  const ID = '6ade7935c6013f4b0dbc8f86';

  it('a list of { file_id } is a list of uploads, up to 10', () => {
    expect(uploadIdsOf([{ file_id: ID }])).toEqual({ ok: true, refs: [{ fileId: ID }] });
    expect(uploadIdsOf(Array.from({ length: 11 }, () => ({ file_id: ID })))).toMatchObject({ ok: false });
    expect(uploadIdsOf([{ file_id: 'x' }])).toMatchObject({ ok: false });
  });

  it('a gallery list (urls) is not an upload list', () => {
    expect(uploadIdsOf([{ url: 'https://lila.constroad.com/a.jpg', mime: 'image/jpeg' }])).toBeNull();
  });

  it('a prospect\'s post carries the uploads with its text as caption', () => {
    const valid = validateBotPost({ prospect: 'dali:51999', as_contact: true, text: 'Les mando los metrados', files: [{ file_id: ID }], idempotency_key: 'wamid.1' });
    expect(valid).toMatchObject({ ok: true, post: { uploads: [{ fileId: ID }], text: 'Les mando los metrados' } });
    expect(valid.ok && valid.post.files).toBeUndefined();
  });
});

/** José 27/11: a bot's audio showed 0:00 and a flat line; it may say how long it is and how it looks. */
describe('an audio file with duration_ms and waveform', () => {
  const ID = '6ade7935c6013f4b0dbc8f86';
  const bars = (count: number, level = 0.5) => Array.from({ length: count }, () => level);

  it('maps them to what a member\'s voice note keeps: milliseconds and bars of 0 to 100', () => {
    const waveform = [0, 0.25, 0.5, 1, ...bars(12)];
    expect(uploadIdsOf([{ file_id: ID, duration_ms: 12_400, waveform }])).toEqual({ ok: true, refs: [{ fileId: ID, durationMs: 12_400, onda: [0, 25, 50, 100, ...bars(12, 50)] }] });
  });

  it('both are optional, one without the other', () => {
    expect(uploadIdsOf([{ file_id: ID, duration_ms: 1 }])).toEqual({ ok: true, refs: [{ fileId: ID, durationMs: 1 }] });
    expect(uploadIdsOf([{ file_id: ID, waveform: bars(64) }])).toEqual({ ok: true, refs: [{ fileId: ID, onda: bars(64, 50) }] });
  });

  it('accepts the bounds: 15 minutes, 16 and 64 bars', () => {
    expect(uploadIdsOf([{ file_id: ID, duration_ms: BOT_AUDIO_MAX_MS, waveform: bars(16) }])).toMatchObject({ ok: true });
    expect(BOT_AUDIO_MAX_MS).toBe(15 * 60 * 1000);
  });

  it('refuses a duration that is not a positive integer up to 15 minutes', () => {
    for (const duration_ms of [0, -5, 1.5, BOT_AUDIO_MAX_MS + 1, '12000', null, Number.NaN]) {
      expect(uploadIdsOf([{ file_id: ID, duration_ms }])).toMatchObject({ ok: false, message: expect.stringContaining('duration_ms') });
    }
  });

  it('refuses a waveform with too few or too many bars, or a bar off 0..1', () => {
    for (const waveform of [bars(15), bars(65), [...bars(15), 1.2], [...bars(15), -0.1], [...bars(15), '0.5'], 'x', [...bars(15), Number.NaN]]) {
      expect(uploadIdsOf([{ file_id: ID, waveform }])).toMatchObject({ ok: false, message: expect.stringContaining('waveform') });
    }
  });

  it('a post with a bad one is refused whole', () => {
    expect(validateBotPost({ user: { id: ID }, files: [{ file_id: ID, duration_ms: -1 }], idempotency_key: 'k' })).toMatchObject({ ok: false, message: expect.stringContaining('duration_ms') });
    expect(validateBotPost({ user: { id: ID }, files: [{ file_id: ID, duration_ms: 8000 }], idempotency_key: 'k' })).toMatchObject({ ok: true, post: { uploads: [{ fileId: ID, durationMs: 8000 }] } });
  });
});
