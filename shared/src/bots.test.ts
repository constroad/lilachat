import { describe, expect, it } from 'vitest';
import { appDeliveryWarning, appInstalledLine, botCardSummary, botFilesSummary, validateBotFiles, validateBotCard, validateBotPost } from './bots.js';

const card = {
  kicker: 'PORTAL · PEDIDOS',
  title: '¿Confirmas el pedido 1024?',
  status: { label: 'Por confirmar', tone: 'warn' },
  fields: [{ label: 'Cliente', value: 'Obra Miraflores' }],
  link: { label: 'Ver en Portal', url: 'https://portal.constroad.com/pedidos/1024' },
  actions: [
    { id: 'confirm', label: 'Confirmar', style: 'primary', value: 'pending-77' },
    { id: 'cancel', label: 'Cancelar', style: 'danger', value: 'pending-77' },
  ],
};

/** The bots API contract, `specs/BOTS-API.spec.md` §b. */
describe('bot post', () => {
  it('a text to a channel, with its idempotency key', () => {
    expect(validateBotPost({ channel_id: 'c1', text: '  Pedido listo  ', idempotency_key: 'k1' })).toEqual({ ok: true, post: { target: { channelId: 'c1' }, text: 'Pedido listo', idempotencyKey: 'k1' } });
  });

  it('a 1:1 by phone, normalized to the local number', () => {
    const result = validateBotPost({ user: { phone: '51987654321' }, text: 'Hola', idempotency_key: 'k2' });
    expect(result.ok && result.post.target).toEqual({ userPhone: '987654321' });
  });

  it('exactly one destination', () => {
    expect(validateBotPost({ text: 'x', idempotency_key: 'k' })).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(validateBotPost({ channel_id: 'c1', user: { id: 'u1' }, text: 'x', idempotency_key: 'k' })).toMatchObject({ ok: false, error: 'invalid_request' });
  });

  it('the idempotency key is required and short', () => {
    expect(validateBotPost({ channel_id: 'c1', text: 'x' })).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(validateBotPost({ channel_id: 'c1', text: 'x', idempotency_key: 'k'.repeat(121) })).toMatchObject({ ok: false, error: 'invalid_request' });
  });

  it('needs a text, a card or a checklist', () => {
    expect(validateBotPost({ channel_id: 'c1', idempotency_key: 'k' })).toMatchObject({ ok: false, error: 'invalid_request' });
  });

  it('a thread reply carries the root seq', () => {
    const result = validateBotPost({ channel_id: 'c1', text: 'x', thread_of: 42, idempotency_key: 'k' });
    expect(result.ok && result.post.threadOf).toBe(42);
  });

  it('a checklist with its people by phone and dates', () => {
    const result = validateBotPost({ channel_id: 'c1', idempotency_key: 'k', checklist: { title: 'Despacho 1024', others_can_mark: false, items: [{ text: 'Cargar tolva', assignee_phone: '51987654321', due_at: '2026-10-22T13:00:00Z' }, { text: 'Pesar' }] } });
    expect(result.ok && result.post.checklist).toEqual({ title: 'Despacho 1024', othersCanMark: false, items: [{ text: 'Cargar tolva', assigneePhone: '987654321', dueAt: '2026-10-22T13:00:00.000Z' }, { text: 'Pesar' }] });
  });

  it('a person that is not a Peruvian cell phone is refused', () => {
    expect(validateBotPost({ channel_id: 'c1', idempotency_key: 'k', checklist: { title: 'T', items: [{ text: 'a', assignee_phone: '123' }] } })).toMatchObject({ ok: false, error: 'invalid_request' });
  });
});

describe('bot card', () => {
  it('keeps a valid card whole, with its actions and their opaque values', () => {
    expect(validateBotCard(card)).toEqual({ ok: true, card });
  });

  it('needs a title', () => {
    expect(validateBotCard({ ...card, title: ' ' })).toMatchObject({ ok: false });
  });

  it('up to three actions, with a simple id, a label and a value of up to 2000', () => {
    const action = { id: 'a', label: 'A', value: 'v' };
    expect(validateBotCard({ title: 'T', actions: [action, { ...action, id: 'b' }, { ...action, id: 'c' }, { ...action, id: 'd' }] })).toMatchObject({ ok: false });
    expect(validateBotCard({ title: 'T', actions: [{ ...action, id: 'Con espacio' }] })).toMatchObject({ ok: false });
    expect(validateBotCard({ title: 'T', actions: [{ ...action, value: 'x'.repeat(2001) }] })).toMatchObject({ ok: false });
    expect(validateBotCard({ title: 'T', actions: [action, { ...action }] })).toMatchObject({ ok: false });
  });

  it('an action may carry a line to run, and anything else is left out (José, 05/11)', () => {
    const action = { id: 'ok', label: 'Ok', value: '1' };
    const result = validateBotCard({ title: 'T', actions: [{ ...action, command: '/gastos completar 7' }, { ...action, id: 'no', command: 'gastos' }] });
    expect(result.ok && result.card.actions?.map((one) => one.command)).toEqual(['/gastos completar 7', undefined]);
  });

  it('an action without a style is a secondary one', () => {
    const result = validateBotCard({ title: 'T', actions: [{ id: 'ok', label: 'Ok', value: '1' }] });
    expect(result.ok && result.card.actions).toEqual([{ id: 'ok', label: 'Ok', style: 'secondary', value: '1' }]);
  });

  it('a link label keeps whole words: «Abrir el chat con Inframaq» was cut to «…con Infram» (E2E 24/10)', () => {
    const fits = validateBotCard({ title: 'T', link: { label: 'Abrir el chat con Inframaq', url: 'https://x.com' } });
    const long = validateBotCard({ title: 'T', link: { label: 'Abrir el chat privado con Inframaq para ver los montos', url: 'https://x.com' } });
    expect(fits.ok && fits.card.link?.label).toBe('Abrir el chat con Inframaq');
    expect(long.ok && long.card.link?.label).toBe('Abrir el chat privado con Inframaq para…');
  });

  it('only https links and known tones', () => {
    expect(validateBotCard({ title: 'T', link: { url: 'http://x.com' } })).toMatchObject({ ok: false });
    expect(validateBotCard({ title: 'T', status: { label: 'X', tone: 'purple' } })).toMatchObject({ ok: false });
  });

  it('the summary the list, notices and search read', () => {
    expect(botCardSummary(card)).toBe('¿Confirmas el pedido 1024? · Por confirmar');
  });
});

describe('Integraciones lines', () => {
  it('who installed it and when, in Lima', () => {
    expect(appInstalledLine({ installedBy: 'José', installedAt: '2026-10-21T15:00:00Z' })).toMatch(/^Instalada por José · 21 oct/);
    expect(appInstalledLine({ installedBy: null, installedAt: '2026-10-21T15:00:00Z' })).toMatch(/^Instalada el 21 oct/);
  });

  it('a failed last event is said; a good one or none, not', () => {
    expect(appDeliveryWarning({ lastDelivery: { at: 'x', ok: false, error: 'HTTP 500' } })).toBe('El último aviso a la app falló (HTTP 500). Se reintenta solo.');
    expect(appDeliveryWarning({ lastDelivery: { at: 'x', ok: true } })).toBeNull();
    expect(appDeliveryWarning({})).toBeNull();
  });
});

/** José via agentes 09/11: a unit's photos and videos in #planta as a person's album, not a card. */
describe('a bot message with files', () => {
  const photo = { url: 'https://lila.constroad.com/files/a.jpg', thumb_url: 'https://lila.constroad.com/files/a-t.jpg', mime: 'image/jpeg' };
  const video = { url: 'https://lila.constroad.com/files/b.mp4', mime: 'video/mp4' };
  it('posts files alone, with the same hosts and kinds as the gallery', () => {
    expect(validateBotPost({ channel_id: 'c1', files: [photo, video, { ...photo, url: 'https://evil.example/x.jpg' }], idempotency_key: 'k' })).toEqual({ ok: true, post: { target: { channelId: 'c1' }, files: [{ url: photo.url, thumbUrl: photo.thumb_url, mime: 'image/jpeg' }, { url: video.url, mime: 'video/mp4' }], idempotencyKey: 'k' } });
  });
  it('refuses files with none valid', () => {
    expect(validateBotFiles([{ url: 'https://evil.example/x.jpg', mime: 'image/jpeg' }])).toMatchObject({ ok: false });
  });
  it('says what it holds for the chat list and the notice', () => {
    expect(botFilesSummary([{ url: 'a', mime: 'image/jpeg' }, { url: 'b', mime: 'image/png' }, { url: 'c', mime: 'video/mp4' }])).toBe('2 fotos y 1 video');
    expect(botFilesSummary([{ url: 'a', mime: 'image/jpeg' }])).toBe('1 foto');
  });
});

describe('a card link that is a file (José 13/11: «Ver PDF» must open the viewer)', () => {
  it('keeps the mime of a PDF, a photo or a video, and drops any other', () => {
    // Arrange / Act
    const pdf = validateBotCard({ title: 'Cotización COT-0000318', link: { label: 'Ver PDF', url: 'https://portal.constroad.com/api/public/quote-pdf/318', mime: 'application/pdf' } });
    const page = validateBotCard({ title: 'T', link: { label: 'Abrir', url: 'https://x.com', mime: 'text/html' } });
    // Assert
    expect(pdf.ok && pdf.card.link).toEqual({ label: 'Ver PDF', url: 'https://portal.constroad.com/api/public/quote-pdf/318', mime: 'application/pdf' });
    expect(page.ok && page.card.link).toEqual({ label: 'Abrir', url: 'https://x.com' });
  });
});

describe('a technical visit card in the reports topic (agentes 14/11)', () => {
  it('keeps the visit id the card points to, so the chat draws it as lv01', () => {
    // Arrange
    const raw = { topic: 'informes', idempotency_key: 'k1', kind: 'visita.updated', refs: { visit_id: '65f0000000000000000000a1' }, card: { title: 'Visita técnica' } };
    // Act
    const checked = validateBotPost(raw);
    // Assert
    expect(checked.ok && checked.post.clientRef).toEqual({ kind: 'visita.updated', visitId: '65f0000000000000000000a1' });
  });
  it('an id that is not a visit is left out, never refused', () => {
    const checked = validateBotPost({ topic: 'informes', idempotency_key: 'k1', kind: 'visita.created', refs: { visit_id: '../x' }, card: { title: 'Visita técnica' } });
    expect(checked.ok && checked.post.clientRef).toEqual({ kind: 'visita.created' });
  });
  const five = ['visita_marcar_punto', 'visita_entrevista', 'visita_foto', 'visita_terminar', 'visita_croquis'].map((id) => ({ id, label: id.slice(7, 30), value: '' }));
  it('a visit card carries the five buttons of lv01 and the croquis', () => {
    // Arrange
    const raw = { topic: 'informes', idempotency_key: 'k1', kind: 'visita.updated', refs: { visit_id: '65f0000000000000000000a1' }, card: { title: 'Visita técnica', actions: five } };
    // Act
    const checked = validateBotPost(raw);
    // Assert
    expect(checked.ok && checked.post.card?.actions?.length).toBe(5);
  });
  it('any other card, or a visit card with a sixth button, is refused', () => {
    expect(validateBotPost({ topic: 'informes', idempotency_key: 'k1', card: { title: 'T', actions: five } })).toMatchObject({ ok: false, message: 'La tarjeta lleva hasta 3 acciones.' });
    expect(validateBotPost({ topic: 'informes', idempotency_key: 'k1', kind: 'visita.created', refs: { visit_id: '../x' }, card: { title: 'T', actions: five } })).toMatchObject({ ok: false });
    const six = [...five, { id: 'visita_pdf', label: 'PDF', value: '' }];
    expect(validateBotPost({ topic: 'informes', idempotency_key: 'k1', kind: 'visita.updated', refs: { visit_id: '65f0000000000000000000a1' }, card: { title: 'T', actions: six } })).toMatchObject({ ok: false, message: 'La tarjeta lleva hasta 5 acciones.' });
  });
});
