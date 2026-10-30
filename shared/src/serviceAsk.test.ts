import { describe, expect, it } from 'vitest';
import { readServiceAsk, serviceAskPath } from './serviceAsk.js';

/** What app and web read from GET …/services/:id/files and …/detail (pending 121; José 30/10). */
describe('serviceAskPath', () => {
  it('escapes the ids Portal sends', () => {
    expect(serviceAskPath('w1', 'cli 1', 'srv/2', 'detail')).toBe('/workspaces/w1/clients/cli%201/services/srv%2F2/detail');
  });
});

describe('readServiceAsk', () => {
  it('the files with the Drive link', () => {
    const files = [{ name: 'a.pdf', mime: 'application/pdf', url: 'https://x/a' }];
    expect(readServiceAsk('files', { files, drive_url: 'https://drive/1' })).toEqual({ ok: true, value: { files, driveUrl: 'https://drive/1' } });
  });

  it('the detail as the server validated it', () => {
    const detail = { service: { id: 's', name: 'S' }, orders: [], dispatches: [], reports: [], totals: { orders: 0, dispatches: 0, reports: 0 } };
    expect(readServiceAsk('detail', { detail })).toEqual({ ok: true, value: detail });
  });

  it('a failure keeps the server message and whichever Portal link came', () => {
    expect(readServiceAsk('files', { error: 'drive_failed', message: 'No se pudo traer el Drive', drive_url: 'https://drive/1' })).toEqual({ ok: false, message: 'No se pudo traer el Drive', portalUrl: 'https://drive/1' });
    expect(readServiceAsk('detail', { error: 'detail_failed', message: 'X', portal_url: 'https://portal/s' })).toEqual({ ok: false, message: 'X', portalUrl: 'https://portal/s' });
  });

  it('no body (no network, 404) reads as the generic failure without a link', () => {
    expect(readServiceAsk('detail', null)).toEqual({ ok: false, message: 'No se pudo traer el detalle del servicio', portalUrl: null });
    expect(readServiceAsk('files', null)).toEqual({ ok: false, message: 'No se pudo traer el Drive', portalUrl: null });
  });
});
