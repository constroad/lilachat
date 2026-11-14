import { describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from './botCommands.js';
import type { FormSubmitReply } from './appActions.js';
import { NEW_VISIT, VISIT_WITH_ID } from './siteVisit.fixture.js';
import { openVisitRowsOf, visitDocumentOf } from './siteVisit.js';
import { isPortalUploadTicket } from './driveUpload.js';
import { addVisitPhoto, finishVisit, markVisitPoint, visitDraftResultOf, visitPdf, visitPhotoFields, visitPointRequest, createdVisitIdOf, saveVisitAnswers, type VisitFlowDeps } from './visitFlow.js';

const VISIT = '65f0000000000000000000a1';
const POINT = '0b6f1a4e-2c3d-4e5f-8a9b-1c2d3e4f5a6b';
const TICKET = { url: 'https://www.constroad.com/api/public/site-visit-upload/eyJ.x.y', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2026-11-14T20:30:00.000Z', maxBytes: 52428800, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] };
const POINT_REQUEST = visitPointRequest(VISIT, POINT, { type: 'BACHE', lat: -12.02, lng: -76.88 }, 'apk');
const opened: CommandOutcome = { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'form' };
const answered = (data: Record<string, unknown>, text?: string): FormSubmitReply => ({ ok: true, outcome: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', ...(text ? { text } : {}), data } } });

function depsOf(reply: FormSubmitReply, send: VisitFlowDeps<string>['send'] = vi.fn(async () => ({ status: 201 }))): VisitFlowDeps<string> & { open: ReturnType<typeof vi.fn> } {
  return { open: vi.fn(async () => ({ ok: true as const, data: opened })), submit: vi.fn(async () => reply), notice: vi.fn(async () => null), send, newKey: () => 'k-1' };
}

describe('the visit read through the server', () => {
  it('an open visit is the document our server read; a new one brings the open ones', () => {
    // Arrange: what `POST /visits/draft` answers, already read from Portal's sheet
    const sent = { document: visitDocumentOf(VISIT_WITH_ID), visits: [] };
    const sentNew = { document: visitDocumentOf(NEW_VISIT.document), visits: openVisitRowsOf(NEW_VISIT.visitas) };
    // Act
    const one = visitDraftResultOf({ ok: true, data: sent });
    const fresh = visitDraftResultOf({ ok: true, data: sentNew });
    // Assert
    expect(one).toMatchObject({ ok: true, document: { id: VISIT, code: 'VIS-2026-0003' }, visits: [] });
    expect(fresh.ok && fresh.visits.length).toBeGreaterThan(0);
  });
  it('Portal\'s own refusal reaches the person; a broken answer says it could not open', () => {
    expect(visitDraftResultOf({ ok: true, data: { error: 'visitas_apagadas', message: 'Están apagadas.' } })).toEqual({ ok: false, message: 'Están apagadas.' });
    expect(visitDraftResultOf({ ok: true, data: { document: VISIT_WITH_ID } })).toEqual({ ok: false, message: 'No se pudo abrir la visita.' });
    expect(visitDraftResultOf({ ok: false, message: 'Sin señal.' })).toEqual({ ok: false, message: 'Sin señal.' });
  });
  it('a new visit\'s id is read from what saving its details answered', () => {
    expect(createdVisitIdOf({ visitaId: VISIT })).toBe(VISIT);
    expect(createdVisitIdOf({ id: VISIT })).toBe(VISIT);
    expect(createdVisitIdOf({ visitaId: 'x' })).toBeNull();
    expect(createdVisitIdOf(undefined)).toBeNull();
  });
});

describe('marking a point', () => {
  it('the request carries the draft as the server asks it, with the key that makes a repeat the same point', () => {
    // Act
    const request = visitPointRequest(VISIT, POINT, { type: 'GIBA', lat: -12.02, lng: -76.88, precisionM: 6, measure: 4, unit: 'm', note: 'Frente al 120' }, 'apk');
    // Assert
    expect(request).toEqual({ kind: 'point', visit_id: VISIT, entry_id: POINT, type: 'GIBA', lat: -12.02, lng: -76.88, precision_m: 6, measure: 4, unit: 'm', note: 'Frente al 120', source: 'apk' });
  });
  it('saved, its photo goes to Portal\'s ticket with its own upload key', async () => {
    // Arrange
    const send = vi.fn(async () => ({ status: 201 }));
    const deps = depsOf(answered({ puntoId: POINT, n: 2, upload: TICKET }), send);
    // Act
    const outcome = await markVisitPoint(deps, POINT_REQUEST, 'photo.jpg', '2026-11-14T12:00:00.000Z');
    // Assert
    expect(outcome).toEqual({ ok: true, n: 2, pointId: POINT });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ url: TICKET.url, fileField: 'file', fields: expect.objectContaining({ lat: '-12.02', lng: '-76.88', takenAt: '2026-11-14T12:00:00.000Z' }) }), 'photo.jpg', 'k-1');
  });
  it('the point stays saved when its photo fails: the screen offers to send the photo again', async () => {
    const deps = depsOf(answered({ puntoId: POINT, n: 2, upload: TICKET }), vi.fn(async () => ({ message: 'Sin señal.' })));
    expect(await markVisitPoint(deps, POINT_REQUEST, 'photo.jpg')).toEqual({ ok: true, n: 2, pointId: POINT, photoFailed: 'No se pudo subir la foto. Revisa tu señal y vuelve a intentarlo.' });
  });
  it('without a photo nothing is sent; an answer without the point is a failure with Portal\'s text', async () => {
    const send = vi.fn(async () => ({ status: 201 }));
    expect(await markVisitPoint(depsOf(answered({ puntoId: POINT, n: 3, upload: TICKET }), send), POINT_REQUEST, null)).toEqual({ ok: true, n: 3, pointId: POINT });
    expect(send).not.toHaveBeenCalled();
    expect(await markVisitPoint(depsOf(answered({}, 'La visita ya está cerrada.')), POINT_REQUEST, 'p')).toEqual({ ok: false, message: 'La visita ya está cerrada.' });
  });
  it('refused by agentes, its words reach the person', async () => {
    const deps = depsOf({ ok: false, errors: { _: 'Elige qué es.' } });
    expect(await markVisitPoint(deps, POINT_REQUEST, 'p')).toEqual({ ok: false, message: 'Elige qué es.' });
  });
});

describe('one more photo, finishing and the PDF', () => {
  it('a stamped shot may be forwarded by our server to the visit\'s ticket, and to no other address', () => {
    expect(isPortalUploadTicket(TICKET.url)).toBe(true);
    expect(isPortalUploadTicket('https://evil.com/api/public/site-visit-upload/x')).toBe(false);
  });
  it('a photo asks a new ticket and sends; an expired ticket asks once more', async () => {
    // Arrange
    const send = vi.fn().mockResolvedValueOnce({ status: 410 }).mockResolvedValueOnce({ status: 200 });
    const deps = depsOf(answered({ upload: TICKET }), send);
    // Act
    const outcome = await addVisitPhoto(deps, VISIT, 'p.jpg', POINT);
    // Assert
    expect(outcome).toEqual({ ok: true });
    expect(deps.open).toHaveBeenCalledTimes(2);
    expect(deps.open).toHaveBeenCalledWith({ kind: 'photo', visit_id: VISIT, point_id: POINT });
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({ fields: TICKET.fields }), 'p.jpg', 'k-1');
  });
  it('a loose photo carries where and when it was taken: Portal draws it as «F» (Portal 43a1f701)', async () => {
    // Arrange
    const send = vi.fn(async () => ({ status: 201 }));
    const deps = depsOf(answered({ upload: TICKET }), send);
    // Act
    await addVisitPhoto(deps, VISIT, 'p.jpg', undefined, { lat: -12.0216, lng: -76.8816, precisionM: 38, takenAt: '2026-11-14T12:34:00.000Z' });
    // Assert
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ fields: { lat: '-12.0216', lng: '-76.8816', precisionM: '38', takenAt: '2026-11-14T12:34:00.000Z', ...TICKET.fields } }), 'p.jpg', 'k-1');
  });
  it('without a position the photo still says when; a broken place is left out', () => {
    expect(visitPhotoFields({ takenAt: '2026-11-14T12:34:00.000Z' })).toEqual({ takenAt: '2026-11-14T12:34:00.000Z' });
    expect(visitPhotoFields({ lat: Number.NaN, lng: -76.88, takenAt: '2026-11-14T12:34:00.000Z' })).toEqual({ takenAt: '2026-11-14T12:34:00.000Z' });
  });
  it('finishing with something missing says the first thing', async () => {
    expect(await finishVisit(depsOf(answered({ missing: ['la conclusión', 'un punto'] })), VISIT)).toEqual({ ok: false, message: 'Falta: la conclusión' });
    expect(await finishVisit(depsOf(answered({}, 'Visita terminada.')), VISIT)).toEqual({ ok: true, message: 'Visita terminada.' });
  });
  it('the PDF opens by its address; while it is made the person reads so', async () => {
    expect(await visitPdf(depsOf(answered({ status: 'ready', url: 'https://www.constroad.com/x.pdf' })), VISIT)).toEqual({ ok: true, url: 'https://www.constroad.com/x.pdf' });
    expect(await visitPdf(depsOf(answered({ status: 'generating' })), VISIT)).toEqual({ ok: false, message: 'El PDF se está generando. Vuelve a tocar en un momento.' });
  });
});

describe('an interview answer (lv03)', () => {
  it('opens the interview of that visit and sends only the answered slot', async () => {
    // Arrange
    const deps = depsOf({ ok: true, outcome: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Guardado.' } } });
    // Act
    const saved = await saveVisitAnswers(deps, VISIT, { r02: 'Arena' });
    // Assert
    expect(deps.open).toHaveBeenCalledWith({ kind: 'section', section: 'entrevista', visit_id: VISIT });
    expect(deps.submit).toHaveBeenCalledWith('c1', { r02: 'Arena' });
    expect(saved).toEqual({ ok: true, message: 'Guardado.' });
  });
});
