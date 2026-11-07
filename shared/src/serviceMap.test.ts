import { describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from './botCommands';
import { MAP_LINK_DAYS, MAP_LINK_FAILED, serviceMapPage, serviceMapUrl, type ServiceMapDeps } from './serviceMap';

/** José 06/11: «si el servicio tiene mapa agrega un tab mapa». Portal's public page draws it, from a link made on the tap. */
const URL_OF_LINK = 'https://constroad.com/public/service-report/token/service/srv-1';
const opened: CommandOutcome = { commandId: 'run-1', appId: 'app-1', appName: 'Portal', outcome: 'form' };
const answer = (outcome: Partial<CommandOutcome>): CommandOutcome => ({ ...opened, outcome: 'ephemeral', ...outcome });
const card = { title: 'Enlace del servicio', fields: [], link: { label: 'Abrir enlace', url: URL_OF_LINK } };
const responseWithLink = { responseType: 'ephemeral' as const, card };
const deps = (over: Partial<ServiceMapDeps> = {}): ServiceMapDeps => ({
  open: vi.fn(async () => ({ ok: true as const, data: opened })),
  submit: vi.fn(async () => ({ ok: true as const, outcome: answer({ response: responseWithLink }) })),
  notice: vi.fn(async () => null),
  ...over,
});

describe('serviceMapUrl', () => {
  it('opens the link form, answers it with the short term and returns the link', async () => {
    // Arrange
    const given = deps();
    // Act
    const result = await serviceMapUrl(given);
    // Assert
    expect(result).toEqual({ ok: true, url: URL_OF_LINK });
    expect(given.submit).toHaveBeenCalledWith('run-1', { dias: MAP_LINK_DAYS });
  });

  it('waits for a late answer', async () => {
    const result = await serviceMapUrl(deps({
      submit: vi.fn(async () => ({ ok: true as const, outcome: answer({ outcome: 'pending' }) })),
      notice: vi.fn(async () => ({ response: responseWithLink })),
    }));
    expect(result).toEqual({ ok: true, url: URL_OF_LINK });
  });

  it('an action that does not ask for a form answers on opening', async () => {
    const given = deps({ open: vi.fn(async () => ({ ok: true as const, data: answer({ response: responseWithLink }) })) });
    expect(await serviceMapUrl(given)).toEqual({ ok: true, url: URL_OF_LINK });
    expect(given.submit).not.toHaveBeenCalled();
  });

  it('says why when the app refuses, and never returns a link it did not get', async () => {
    expect(await serviceMapUrl(deps({ open: vi.fn(async () => ({ ok: false as const, message: 'x' })) }))).toEqual({ ok: false, message: MAP_LINK_FAILED });
    expect(await serviceMapUrl(deps({ submit: vi.fn(async () => ({ ok: false as const, message: 'Sin permiso' })) }))).toEqual({ ok: false, message: 'Sin permiso' });
    expect(await serviceMapUrl(deps({ submit: vi.fn(async () => ({ ok: true as const, outcome: answer({ outcome: 'failed', message: 'Portal no respondió' }) })) }))).toEqual({ ok: false, message: 'Portal no respondió' });
    expect(await serviceMapUrl(deps({ submit: vi.fn(async () => ({ ok: true as const, outcome: answer({ response: { responseType: 'ephemeral', text: 'Listo' } }) })) }))).toEqual({ ok: false, message: MAP_LINK_FAILED });
  });

  it('a link that is not https does not open', async () => {
    const plain = { responseType: 'ephemeral' as const, card: { ...card, link: { label: 'Abrir', url: 'javascript:alert(1)' } } };
    expect(await serviceMapUrl(deps({ submit: vi.fn(async () => ({ ok: true as const, outcome: answer({ response: plain }) })) }))).toEqual({ ok: false, message: MAP_LINK_FAILED });
  });
});

describe('serviceMapPage', () => {
  it('goes straight to the map of that service, not to the report\'s first page', () => {
    expect(serviceMapPage('https://constroad.com/public/test/service-report/abc', 'srv-1')).toBe('https://constroad.com/public/test/service-report/abc/service/srv-1?section=map');
  });

  it('a link that already names the service keeps it', () => {
    expect(serviceMapPage('https://constroad.com/public/test/service-report/abc/service/srv-1', 'srv-1')).toBe('https://constroad.com/public/test/service-report/abc/service/srv-1?section=map');
  });
});
