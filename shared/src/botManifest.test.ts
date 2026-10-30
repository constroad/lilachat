import { describe, expect, it } from 'vitest';
import { MANIFEST_LIMITS, newScopesOf, validateAppManifest } from './botManifest.js';

const manifest = {
  key: 'inframaq',
  name: '  Inframaq ',
  avatar_url: 'https://agentes.constroad.com/logos/inframaq.png',
  redirect_uri: 'https://agentes.constroad.com/canales/lilachat/vuelta',
  webhook_url: 'https://agentes.constroad.com/v1/channels/lilachat/events',
  install_url: 'https://agentes.constroad.com/canales/lilachat/instalar?app=inframaq',
  commands: [{ command: 'clima', description: 'Clima de la planta', usage_hint: '[mañana]' }],
};

/** The app manifest a developer app (agentes) sends to `POST /api/bots/apps` (`specs/BOTS-API.spec.md` §0-bis). */
describe('app manifest', () => {
  it('keeps every field in the server shape, trimmed', () => {
    expect(validateAppManifest(manifest)).toEqual({
      ok: true,
      manifest: {
        key: 'inframaq',
        name: 'Inframaq',
        avatarUrl: 'https://agentes.constroad.com/logos/inframaq.png',
        redirectUri: 'https://agentes.constroad.com/canales/lilachat/vuelta',
        webhookUrl: 'https://agentes.constroad.com/v1/channels/lilachat/events',
        installUrl: 'https://agentes.constroad.com/canales/lilachat/instalar?app=inframaq',
        commands: [{ command: 'clima', description: 'Clima de la planta', usageHint: '[mañana]' }],
        shortcuts: [],
        noticeTopics: [],
        suggestedSchedules: [],
        scopes: [],
      },
    });
  });

  it('avatar, install address and commands are optional; without commands they are not touched', () => {
    const result = validateAppManifest({ key: 'portal', name: 'Portal', redirect_uri: manifest.redirect_uri, webhook_url: manifest.webhook_url });
    expect(result).toEqual({ ok: true, manifest: { key: 'portal', name: 'Portal', redirectUri: manifest.redirect_uri, webhookUrl: manifest.webhook_url, shortcuts: [], noticeTopics: [], suggestedSchedules: [], scopes: [] } });
  });

  it('refuses a bad key, a missing name and addresses without https', () => {
    for (const key of ['Inframaq', 'i', '1app', 'mi app', `a${'b'.repeat(MANIFEST_LIMITS.key)}`]) expect(validateAppManifest({ ...manifest, key }).ok, key).toBe(false);
    expect(validateAppManifest({ ...manifest, name: ' ' })).toEqual({ ok: false, message: 'Falta «name»: el nombre de la app, hasta 40.' });
    expect(validateAppManifest({ ...manifest, webhook_url: 'http://agentes.constroad.com/x' }).ok).toBe(false);
    expect(validateAppManifest({ ...manifest, avatar_url: 'ftp://x' }).ok).toBe(false);
  });

  it('a local http address is fine for an agentes in development', () => {
    expect(validateAppManifest({ ...manifest, webhook_url: 'http://127.0.0.1:4099/events' }).ok).toBe(true);
  });

  it('the directory texts: a line, up to six features, who made it and a known category; long texts are cut, never refused', () => {
    const result = validateAppManifest({ ...manifest, description: '  Clima, asistencias y tanques de la planta ', developer: 'Agentes ConstRoad', category: 'operacion', features: ['El clima de la planta', '', 'x'.repeat(300), 'a', 'b', 'c', 'd', 'e'] });
    expect(result.ok && result.manifest).toMatchObject({ description: 'Clima, asistencias y tanques de la planta', developer: 'Agentes ConstRoad', category: 'operacion' });
    expect(result.ok && result.manifest.features).toHaveLength(MANIFEST_LIMITS.features);
    expect(result.ok && result.manifest.features?.[1]).toHaveLength(MANIFEST_LIMITS.feature);
    const unknown = validateAppManifest({ ...manifest, category: 'juegos', description: 'd'.repeat(500) });
    expect(unknown.ok && unknown.manifest.category).toBeUndefined();
    expect(unknown.ok && unknown.manifest.description).toHaveLength(MANIFEST_LIMITS.description);
  });

  it('a long text is cut at a whole word, without a dangling comma, and ends in «…» within the limit', () => {
    // Arrange
    const portal = 'Portal en Lilachat: listar pedidos, ver un pedido, buscar clientes, listar despachos, asistencia del día, estado de los tanques y crear pedidos';
    // Act
    const result = validateAppManifest({ ...manifest, description: portal, developer: 'Agentes ConstRoad, el equipo de producto que hace las apps de la empresa' });
    // Assert
    const description = result.ok ? (result.manifest.description ?? '') : '';
    expect(description.length).toBeLessThanOrEqual(MANIFEST_LIMITS.description);
    expect(description).toBe('Portal en Lilachat: listar pedidos, ver un pedido, buscar clientes, listar despachos, asistencia del día, estado de los…');
    expect(result.ok && result.manifest.developer).toBe('Agentes ConstRoad, el equipo de producto que hace las apps…');
    expect(result.ok && result.manifest.developer!.length).toBeLessThanOrEqual(MANIFEST_LIMITS.developer);
  });

  it('shortcuts for the «+» menu: cut to 40 and 80, up to 20; none (or no key) means none, so a retired tool takes its shortcut away', () => {
    // Arrange
    const long = { key: 'marcar_asistencia', name: 'Marcar asistencia de ingreso, refrigerio, retorno y salida del personal', description: 'Ingreso, refrigerio, retorno o salida, con tu ubicación y una selfie, desde cualquier canal del espacio' };
    // Act
    const withShortcut = validateAppManifest({ ...manifest, shortcuts: [long] });
    const without = validateAppManifest(manifest);
    // Assert
    const shortcut = withShortcut.ok ? withShortcut.manifest.shortcuts[0]! : null;
    expect(shortcut?.key).toBe('marcar_asistencia');
    expect(shortcut!.name.length).toBeLessThanOrEqual(40);
    expect(shortcut!.description!.length).toBeLessThanOrEqual(80);
    expect(without.ok && without.manifest.shortcuts).toEqual([]);
    expect(validateAppManifest({ ...manifest, shortcuts: [{ key: 'Mal Key', name: 'x' }] }).ok).toBe(false);
    // agentes 30/10: Portal's 11th approved action (crear_cliente) was lost; all start off, so the cap guards nothing at 10.
    expect(validateAppManifest({ ...manifest, shortcuts: Array.from({ length: 20 }, (_, i) => ({ key: `a${i}`, name: `A${i}` })) }).ok).toBe(true);
    expect(validateAppManifest({ ...manifest, shortcuts: Array.from({ length: 21 }, (_, i) => ({ key: `a${i}`, name: `A${i}` })) }).ok).toBe(false);
  });

  it('bad commands are refused with the same message as PUT /api/bots/commands', () => {
    expect(validateAppManifest({ ...manifest, commands: [{ command: '/Clima', description: 'x' }] }).ok).toBe(false);
  });

  it('schedules (agentes, 28/10): commands say schedulable and shareable, and the app suggests schedules for them', () => {
    const checked = validateAppManifest({
      ...manifest,
      commands: [{ command: 'asistencia', description: 'Asistencia', schedulable: true }, { command: 'planilla', description: 'Planilla', schedulable: true, shareable: false }],
      suggested_schedules: [{ command: 'asistencia', text: '', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] } }, { command: 'clima', time: '06:00', repeat: { every: 1 } }],
    });
    expect(checked.ok && checked.manifest.commands).toEqual([{ command: 'asistencia', description: 'Asistencia', schedulable: true }, { command: 'planilla', description: 'Planilla', schedulable: true, shareable: false }]);
    expect(checked.ok && checked.manifest.suggestedSchedules).toEqual([{ command: 'asistencia', text: '', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: false }]);
    const none = validateAppManifest(manifest);
    expect(none.ok && none.manifest.suggestedSchedules).toEqual([]);
  });

  it('a topic offered only to the installation the app chooses (agentes, 28/10: its alerts)', () => {
    const checked = validateAppManifest({ ...manifest, notice_topics: [{ key: 'alertas', name: 'Alertas de agentes', offer: 'chosen' }, { key: 'asistencia', name: 'Asistencia', offer: 'all' }] });
    expect(checked.ok && checked.manifest.noticeTopics).toEqual([{ key: 'alertas', name: 'Alertas de agentes', offerChosen: true }, { key: 'asistencia', name: 'Asistencia' }]);
  });
});

describe('scopes (pending 95: the verified email, accepted when installing)', () => {
  it('keeps the known ones once; an unknown scope is ignored, not an error', () => {
    const parsed = validateAppManifest({ ...manifest, scopes: ['users:read.email', 'users:read.email', 'admin:all'] });
    expect(parsed.ok && parsed.manifest.scopes).toEqual(['users:read.email']);
    const none = validateAppManifest(manifest);
    expect(none.ok && none.manifest.scopes).toEqual([]);
  });
  it('what the app asks and the installation did not accept is new', () => {
    expect(newScopesOf(['users:read.email'], [])).toEqual(['users:read.email']);
    expect(newScopesOf(['users:read.email'], ['users:read.email'])).toEqual([]);
    expect(newScopesOf(undefined, undefined)).toEqual([]);
  });
});
