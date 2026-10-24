import { describe, expect, it } from 'vitest';
import { appActivityLine, appChatLink, appInstalledByLine, appReturnFromLink, appReturnLink, directoryChips, filterDirectory, installedWithoutChat, uninstallWarning } from './appDirectory.js';
import type { DirectoryApp } from './bots.js';

const app = (name: string, extra: Partial<DirectoryApp> = {}): DirectoryApp => ({ appId: name.toLowerCase(), clientId: `lca_${name.toLowerCase()}`, name, features: [], commands: [], ...extra });
const installation = { installationId: 'i', botUserId: 'b', installedBy: 'José Zamora', installedAt: '2026-10-23T15:00:00Z', channels: 3, directs: 12 };
const apps = [
  app('Inframaq', { description: 'Clima, asistencias y tanques de la planta', category: 'operacion', installation }),
  app('Portal', { description: 'Pedidos, despachos y caja', category: 'operacion', installation }),
  app('Pulso', { description: 'Asistencia del personal', category: 'personas' }),
  app('Lab Vial', { description: 'Ensayos y certificados de laboratorio', category: 'laboratorio' }),
];

describe('the apps directory (design e-24)', () => {
  it('chips: all, installed with how many, then only the categories that have apps', () => {
    expect(directoryChips(apps)).toEqual([
      { key: 'all', label: 'Todas' },
      { key: 'installed', label: 'Instaladas (2)' },
      { key: 'operacion', label: 'Operación' },
      { key: 'personas', label: 'Personas' },
      { key: 'laboratorio', label: 'Laboratorio' },
    ]);
  });

  it('filters by chip and by name or description, without accents mattering', () => {
    expect(filterDirectory(apps, { filter: 'installed', query: '' }).map((one) => one.name)).toEqual(['Inframaq', 'Portal']);
    expect(filterDirectory(apps, { filter: 'all', query: 'asistencia' }).map((one) => one.name)).toEqual(['Inframaq', 'Pulso']);
    expect(filterDirectory(apps, { filter: 'all', query: 'LABORATORIO' }).map((one) => one.name)).toEqual(['Lab Vial']);
    expect(filterDirectory(apps, { filter: 'personas', query: 'pedidos' })).toEqual([]);
    expect(filterDirectory(apps, { filter: 'all', query: 'operacion' }).map((one) => one.name)).toEqual(['Inframaq', 'Portal']);
  });

  it('where it is active, in singular and plural, and nothing while it is in no chat', () => {
    expect(appActivityLine(installation)).toBe('Activa en 3 canales y 12 mensajes directos');
    expect(appActivityLine({ ...installation, channels: 1, directs: 1 })).toBe('Activa en 1 canal y 1 mensaje directo');
    expect(appActivityLine({ ...installation, channels: 2, directs: 0 })).toBe('Activa en 2 canales');
    expect(appActivityLine({ ...installation, channels: 0, directs: 0 })).toBe('');
  });

  it('the installed apps without a 1:1 yet: not the ones talked to, not the ones not installed', () => {
    expect(installedWithoutChat(apps, [{ appId: 'inframaq' }, {}]).map((one) => one.name)).toEqual(['Portal']);
    expect(installedWithoutChat(apps, [])).toHaveLength(2);
    expect(installedWithoutChat([], [{ appId: 'x' }])).toEqual([]);
  });

  it('who installed it and when, in Lima', () => {
    expect(appInstalledByLine(installation)).toBe('Instalada por José Zamora · 23 oct');
    expect(appInstalledByLine({ ...installation, installedBy: null })).toBe('Instalada el 23 oct');
  });
});

describe('back to Lilachat after installing (agentes\' return address)', () => {
  it('builds the address and reads it back from a URL or a path, with or without a query', () => {
    const link = appReturnLink('6adbb0887ca6f18809904536', 'lca_lnkjg6KXzr_GBiF-YG3V');
    expect(link).toBe('https://lilachat.constroad.com/s/6adbb0887ca6f18809904536/apps/lca_lnkjg6KXzr_GBiF-YG3V');
    expect(appReturnFromLink(`${link}?instalada=1`)).toEqual({ spaceId: '6adbb0887ca6f18809904536', clientId: 'lca_lnkjg6KXzr_GBiF-YG3V' });
    expect(appReturnFromLink('/s/6adbb0887ca6f18809904536/apps/lca_x1')).toEqual({ spaceId: '6adbb0887ca6f18809904536', clientId: 'lca_x1' });
    // Pending 49: «/chat» at the end opens the 1:1 with the app (a product that answers only in private sends it).
    expect(appReturnFromLink('https://lilachat.constroad.com/s/6adbb0887ca6f18809904536/apps/lca_x1/chat')).toEqual({ spaceId: '6adbb0887ca6f18809904536', clientId: 'lca_x1', chat: true });
    expect(appChatLink('6adbb0887ca6f18809904536', 'lca_x1')).toBe('https://lilachat.constroad.com/s/6adbb0887ca6f18809904536/apps/lca_x1/chat');
  });

  it('anything else is not a return address', () => {
    expect(appReturnFromLink('https://lilachat.constroad.com/unirse/ABCD-1234')).toBeNull();
    expect(appReturnFromLink('https://otro.com/s/6adbb0887ca6f18809904536/apps/lca_x1')).toBeNull();
    expect(appReturnFromLink('/s/no-es-un-id/apps/lca_x1')).toBeNull();
    expect(appReturnFromLink(null)).toBeNull();
  });
});

describe('uninstallWarning', () => {
  it('says what goes away and that the connected account stays', () => {
    expect(uninstallWarning('Test')).toBe('Se van sus comandos, sus acciones del ⚡ y sus avisos en Test. Tu cuenta conectada sigue igual, y la puedes instalar de nuevo cuando quieras.');
  });
});
