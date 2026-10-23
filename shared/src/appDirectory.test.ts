import { describe, expect, it } from 'vitest';
import { appActivityLine, appInstalledByLine, directoryChips, filterDirectory, installedWithoutChat } from './appDirectory.js';
import type { DirectoryApp } from './bots.js';

const app = (name: string, extra: Partial<DirectoryApp> = {}): DirectoryApp => ({ appId: name.toLowerCase(), name, features: [], commands: [], ...extra });
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
