import { describe, expect, it } from 'vitest';
import { appDeliveryWarning, appInstalledLine, botCardSummary, validateBotCard, validateBotPost } from './bots.js';

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

  it('an action without a style is a secondary one', () => {
    const result = validateBotCard({ title: 'T', actions: [{ id: 'ok', label: 'Ok', value: '1' }] });
    expect(result.ok && result.card.actions).toEqual([{ id: 'ok', label: 'Ok', style: 'secondary', value: '1' }]);
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
