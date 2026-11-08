import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import { createProgressLink, PROGRESS_LINK_MISSING, progressLinkExpiry, progressLinkOf, workProgressLinkRequest } from './workProgressLink.js';
import type { MapEditSend } from './workScopeDraft.js';

/** «Crear enlace de avance» (o-08, Portal 1d397594): the cut chosen in the panel, signed in the link. */
const URL_OK = 'https://constroad.com/public/test/service-report/tok/service/s1?section=map';

describe('workProgressLinkRequest', () => {
  it('sends the stage, the day and whether photos go; without a cut, only the photos', () => {
    expect(workProgressLinkRequest({ stageId: 'e1', untilDay: '2026-11-06', workId: 'base' }, true)).toEqual({ kind: 'work_progress_link', stage_id: 'e1', until: '2026-11-06', photos: true, forms: FORMS_LEVEL });
    expect(workProgressLinkRequest({}, false)).toEqual({ kind: 'work_progress_link', photos: false, forms: FORMS_LEVEL });
  });
});

describe('progressLinkOf', () => {
  it('takes our link and its days; refuses another address', () => {
    expect(progressLinkOf({ url: URL_OK, dias: 7 })).toEqual({ url: URL_OK, days: 7 });
    expect(progressLinkOf({ url: URL_OK })).toEqual({ url: URL_OK, days: null });
    expect(progressLinkOf({ url: 'https://evil.example/x' })).toBeNull();
    expect(progressLinkOf(undefined)).toBeNull();
  });

  it('says when it expires', () => {
    expect(progressLinkExpiry({ url: URL_OK, days: 7 })).toBe('Vence en 7 días');
    expect(progressLinkExpiry({ url: URL_OK, days: 1 })).toBe('Vence en 1 día');
    expect(progressLinkExpiry({ url: URL_OK, days: null })).toBeNull();
  });
});

describe('createProgressLink', () => {
  it('reads the link from Portal\'s answer, and says when it did not come', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: { url: URL_OK, dias: 7 } }));
    expect(await createProgressLink(send, { stageId: 'e1' }, false)).toEqual({ ok: true, link: { url: URL_OK, days: 7 } });
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_progress_link', stage_id: 'e1', photos: false });
    expect(await createProgressLink(async () => ({ ok: true, message: '' }), {}, false)).toEqual({ ok: false, message: PROGRESS_LINK_MISSING });
    expect(await createProgressLink(async () => ({ ok: false, message: 'Esa etapa no es de este servicio.' }), {}, false)).toEqual({ ok: false, message: 'Esa etapa no es de este servicio.' });
  });
});
