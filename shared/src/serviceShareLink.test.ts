import { describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from './botCommands';
import type { ServiceMapDeps } from './serviceMap';
import { createServiceLink, SERVICE_LINK_DAY_OPTIONS, SERVICE_LINK_FAILED, serviceLinkValues } from './serviceShareLink';

/** José 20/11: «Enlace del servicio» only took him to the chat; the link is made in place now. */
const URL_OF_LINK = 'https://constroad.com/public/service-report/token/service/srv-1';
const opened: CommandOutcome = { commandId: 'run-1', appId: 'app-1', appName: 'Portal', outcome: 'form' };
const withLink: CommandOutcome = { ...opened, outcome: 'ephemeral', response: { responseType: 'ephemeral', card: { title: 'Enlace del servicio', fields: [], link: { label: 'Abrir enlace', url: URL_OF_LINK } } } };
const deps = (over: Partial<ServiceMapDeps> = {}): ServiceMapDeps => ({
  open: vi.fn(async () => ({ ok: true as const, data: opened })),
  submit: vi.fn(async () => ({ ok: true as const, outcome: withLink })),
  notice: vi.fn(async () => null),
  ...over,
});

describe('serviceLinkValues (the form Lilachat opens for the service: `dias` and `noExpira`)', () => {
  it('a term in days', () => {
    expect(serviceLinkValues({ days: 30, never: false })).toEqual({ dias: 30, noExpira: false });
  });
  it('«No expira» ignores the days', () => {
    expect(serviceLinkValues({ days: 7, never: true })).toEqual({ noExpira: true });
  });
  it('a term out of range goes to the closest the form takes (1 to 60)', () => {
    expect(serviceLinkValues({ days: 0, never: false })).toEqual({ dias: 1, noExpira: false });
    expect(serviceLinkValues({ days: 90, never: false })).toEqual({ dias: 60, noExpira: false });
  });
  it('offers 7, 30 and 60 days, the first the form\'s own default', () => {
    expect(SERVICE_LINK_DAY_OPTIONS).toEqual([7, 30, 60]);
  });
});

describe('createServiceLink', () => {
  it('opens the form, answers it with the choice and returns the link', async () => {
    // Arrange
    const given = deps();
    // Act
    const result = await createServiceLink(given, { days: 30, never: false });
    // Assert
    expect(result).toEqual({ ok: true, url: URL_OF_LINK });
    expect(given.submit).toHaveBeenCalledWith('run-1', { dias: 30, noExpira: false });
  });

  it('a refused door says so in the service link\'s words, not the map\'s', async () => {
    expect(await createServiceLink(deps({ open: vi.fn(async () => ({ ok: false as const })) }), { days: 7, never: false })).toEqual({ ok: false, message: SERVICE_LINK_FAILED });
    expect(await createServiceLink(deps({ submit: vi.fn(async () => ({ ok: true as const, outcome: { ...opened, outcome: 'ephemeral' as const, response: { responseType: 'ephemeral' as const, text: 'Listo' } } })) }), { days: 7, never: false })).toEqual({ ok: false, message: SERVICE_LINK_FAILED });
  });

  it('Portal\'s own refusal reaches the person', async () => {
    const given = deps({ submit: vi.fn(async () => ({ ok: false as const, message: 'Sin permiso' })) });
    expect(await createServiceLink(given, { days: 7, never: true })).toEqual({ ok: false, message: 'Sin permiso' });
  });
});
