import { describe, expect, it, vi } from 'vitest';
import { addPhotoToProgress, afterPhotoAdd, PHOTO_ADD_FAILED, PHOTO_ADDED, PROGRESS_CHANGED, PROGRESS_PHOTOS_MAX, photosLabel, progressPhotoResultOf, recordedProgressIdOf, workProgressPhotoRequest } from './workProgressPhoto.js';
import type { WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

const ID = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);

/** José 28/11: «debería marcarlo y luego ya yo igual podría subir la foto». */
describe('the request of agregar_foto_a_avance_de_obra', () => {
  it('carries the record and its Drive photos, a repeated one once', () => {
    // Act
    const request = workProgressPhotoRequest('p1', [ID, ID, OTHER]);
    // Assert
    expect(request).toEqual({ kind: 'work_progress_photo', progress_id: 'p1', photo_ids: [ID, OTHER], forms: expect.any(Number) });
  });

  it('keeps at most six photos and refuses a record or photos missing', () => {
    // Arrange
    const many = Array.from({ length: 9 }, (_, index) => String(index).padStart(24, '0'));
    // Act / Assert
    expect(workProgressPhotoRequest('p1', many)?.photo_ids).toHaveLength(PROGRESS_PHOTOS_MAX);
    expect(workProgressPhotoRequest('', [ID])).toBeNull();
    expect(workProgressPhotoRequest('p1', [])).toBeNull();
    expect(workProgressPhotoRequest('p1', ['', ' '])).toBeNull();
  });
});

describe('what the tool answers', () => {
  it('reads the record and its total of photos, as is or wrapped once more', () => {
    expect(progressPhotoResultOf({ ok: true, message: 'x', data: { avanceId: 'p1', fotos: 3 } })).toEqual({ ok: true, progressId: 'p1', photos: 3, message: PHOTO_ADDED });
    expect(progressPhotoResultOf({ ok: true, message: 'x', data: { data: { avanceId: 'p1', fotos: 2 } } })).toEqual({ ok: true, progressId: 'p1', photos: 2, message: PHOTO_ADDED });
  });

  it('an answer without a count still counts as added, with no total', () => {
    expect(progressPhotoResultOf({ ok: true, message: 'x' })).toEqual({ ok: true, progressId: null, photos: null, message: PHOTO_ADDED });
  });

  it('keeps Portal\'s own refusal, anything else (502, tool missing) is the plain retry', () => {
    expect(progressPhotoResultOf({ ok: false, message: PROGRESS_CHANGED })).toEqual({ ok: false, message: PROGRESS_CHANGED });
    expect(progressPhotoResultOf({ ok: false, message: 'El avance fue deshecho.' })).toEqual({ ok: false, message: 'El avance fue deshecho.' });
    expect(progressPhotoResultOf({ ok: false, message: 'Request failed with status 502' })).toEqual({ ok: false, message: PHOTO_ADD_FAILED });
    expect(progressPhotoResultOf({ ok: false, message: 'tool_not_found' })).toEqual({ ok: false, message: PHOTO_ADD_FAILED });
  });
});

describe('the record just made', () => {
  it('gives the id Portal answered, also on a resend', () => {
    expect(recordedProgressIdOf({ ok: true, message: '', data: { avanceId: 'p7', estado: 'pendiente' } })).toBe('p7');
    expect(recordedProgressIdOf({ ok: true, message: '', data: { data: { avanceId: 'p7', code: 'ya_marcada' } } })).toBe('p7');
    expect(recordedProgressIdOf({ ok: true, message: 'En cola' })).toBeNull();
    expect(recordedProgressIdOf({ ok: false, message: 'no' })).toBeNull();
  });
});

describe('«Agregar foto» on a record', () => {
  const sendOf = (result: WorkProgressResult | Error) => vi.fn<MapEditSend>(async () => { if (result instanceof Error) throw result; return result; });

  it('takes the photo, uploads it, then asks the tool with its id', async () => {
    // Arrange
    const upload = vi.fn(async () => ({ ok: true as const, mediaId: ID }));
    const send = sendOf({ ok: true, message: '', data: { avanceId: 'p1', fotos: 1 } });
    // Act
    const added = await addPhotoToProgress({ take: async () => ({ shot: 'file' }), upload, send, progressId: 'p1' });
    // Assert
    expect(upload).toHaveBeenCalledWith('file');
    expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'work_progress_photo', progress_id: 'p1', photo_ids: [ID] });
    expect(added).toEqual({ ok: true, progressId: 'p1', photos: 1, message: PHOTO_ADDED });
  });

  it('a closed camera sends nothing; a denied camera or a failed upload says why', async () => {
    const send = sendOf({ ok: true, message: '' });
    const upload = vi.fn(async () => ({ ok: false as const, message: 'El archivo pesa demasiado.' }));
    expect(await addPhotoToProgress({ take: async () => null, upload, send, progressId: 'p1' })).toBeNull();
    expect(await addPhotoToProgress({ take: async () => ({ message: 'Sin permiso de cámara.' }), upload, send, progressId: 'p1' })).toEqual({ ok: false, message: 'Sin permiso de cámara.' });
    expect(await addPhotoToProgress({ take: async () => ({ shot: 'file' }), upload, send, progressId: 'p1' })).toEqual({ ok: false, message: 'El archivo pesa demasiado.' });
    expect(send).not.toHaveBeenCalled();
  });

  it('a door that throws is logged and answered with the plain retry, never thrown', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const upload = vi.fn(async () => ({ ok: true as const, mediaId: ID }));
    // Act
    const added = await addPhotoToProgress({ take: async () => ({ shot: 'file' }), upload, send: sendOf(new Error('502 Bad Gateway')), progressId: 'p1' });
    // Assert
    expect(added).toEqual({ ok: false, message: PHOTO_ADD_FAILED });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('the count on the record', () => {
  it('says one or several photos, nothing at zero', () => {
    expect(photosLabel(0)).toBe('');
    expect(photosLabel(1)).toBe('1 foto');
    expect(photosLabel(4)).toBe('4 fotos');
  });
});

describe('after one try', () => {
  it('shows the tool\'s total, one more without it, and keeps the count on a failure', () => {
    expect(afterPhotoAdd({ ok: true, progressId: 'p1', photos: 3, message: PHOTO_ADDED }, 1)).toEqual({ photos: 3, error: null });
    expect(afterPhotoAdd({ ok: true, progressId: null, photos: null, message: PHOTO_ADDED }, 1)).toEqual({ photos: 2, error: null });
    expect(afterPhotoAdd({ ok: false, message: PHOTO_ADD_FAILED }, 1)).toEqual({ photos: 1, error: PHOTO_ADD_FAILED });
    expect(afterPhotoAdd(null, 2)).toEqual({ photos: 2, error: null });
  });
});
