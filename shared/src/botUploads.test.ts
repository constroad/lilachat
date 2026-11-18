import { describe, expect, it } from 'vitest';
import { BOT_UPLOAD_MAX_BYTES, botUploadKindOf, uploadIdsOf } from './botUploads.js';
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
    expect(uploadIdsOf([{ file_id: ID }])).toEqual({ ok: true, ids: [ID] });
    expect(uploadIdsOf(Array.from({ length: 11 }, () => ({ file_id: ID })))).toMatchObject({ ok: false });
    expect(uploadIdsOf([{ file_id: 'x' }])).toMatchObject({ ok: false });
  });

  it('a gallery list (urls) is not an upload list', () => {
    expect(uploadIdsOf([{ url: 'https://lila.constroad.com/a.jpg', mime: 'image/jpeg' }])).toBeNull();
  });

  it('a prospect\'s post carries the uploads with its text as caption', () => {
    const valid = validateBotPost({ prospect: 'dali:51999', as_contact: true, text: 'Les mando los metrados', files: [{ file_id: ID }], idempotency_key: 'wamid.1' });
    expect(valid).toMatchObject({ ok: true, post: { uploads: [ID], text: 'Les mando los metrados' } });
    expect(valid.ok && valid.post.files).toBeUndefined();
  });
});
