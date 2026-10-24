import { describe, expect, it } from 'vitest';
import { appLinkLine, linkOfReply, revokedOfReply } from './appLink.js';

/** «Conectado como … / Desconectar», per app (agentes f02cb99). */
describe('the account a person connected to an app', () => {
  it('reads the app answer: linked with its label, not linked, or unknown for anything else', () => {
    expect(linkOfReply({ linked: true, label: ' j•••@constroad.com ' })).toEqual({ linked: true, label: 'j•••@constroad.com' });
    expect(linkOfReply({ linked: false })).toEqual({ linked: false });
    expect(linkOfReply({ linked: true })).toEqual({ unknown: true });
    expect(linkOfReply({ linked: true, label: '  ' })).toEqual({ unknown: true });
    expect(linkOfReply({ error: 'falta user' })).toEqual({ unknown: true });
    expect(linkOfReply(null)).toEqual({ unknown: true });
    expect(linkOfReply('ok')).toEqual({ unknown: true });
    expect(linkOfReply({ linked: true, label: 'x'.repeat(120) })).toEqual({ linked: true, label: 'x'.repeat(80) });
  });

  it('a revoke worked only with { ok: true }', () => {
    expect(revokedOfReply({ ok: true })).toBe(true);
    expect(revokedOfReply({ ok: false })).toBe(false);
    expect(revokedOfReply({})).toBe(false);
    expect(revokedOfReply(undefined)).toBe(false);
  });

  it('says who I am in the app, how I get connected, or nothing when the app did not say', () => {
    expect(appLinkLine({ linked: true, label: 'j•••@constroad.com' }, 'Portal')).toBe('Conectado como j•••@constroad.com');
    expect(appLinkLine({ linked: false }, 'Portal')).toBe('Sin conectar. Portal te lo pide la primera vez que la usas.');
    expect(appLinkLine({ unknown: true }, 'Portal')).toBeNull();
  });
});
