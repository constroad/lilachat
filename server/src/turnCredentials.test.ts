import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIceServers, turnCredential } from './turnCredentials.js';

/**
 * Las credenciales del TURN (F10).
 *
 * Un servidor TURN reenvía audio y video de verdad, así que **es ancho de banda
 * que alguien paga**. Con una contraseña fija en el cliente, cualquiera que
 * abra el APK tiene un relay gratis para lo que quiera — es el abuso clásico de
 * los TURN mal configurados.
 *
 * Por eso las credenciales son EFÍMERAS: usuario `<vencimiento>:<userId>` y
 * contraseña `HMAC-SHA1(secreto, usuario)`, que es el mecanismo REST estándar
 * de coturn. El secreto vive solo en el server y en el TURN.
 */
const original = { ...process.env };

beforeEach(() => {
  process.env.TURN_URL = 'turn:casa.constroad.com:3478';
  process.env.TURN_SECRET = 'secreto-de-prueba';
});

afterEach(() => {
  process.env = { ...original };
});

describe('turnCredential', () => {
  it('el usuario lleva el vencimiento y quién es', () => {
    const cred = turnCredential('u123', new Date('2026-08-24T12:00:00Z'));

    expect(cred!.username).toMatch(/^\d+:u123$/);
    expect(Number(cred!.username.split(':')[0])).toBeGreaterThan(1787000000);
  });

  /** La contraseña se DERIVA: dos usuarios nunca comparten la misma. */
  it('cada usuario recibe una contraseña distinta', () => {
    const uno = turnCredential('u1', new Date('2026-08-24T12:00:00Z'));
    const otro = turnCredential('u2', new Date('2026-08-24T12:00:00Z'));

    expect(uno!.credential).not.toBe(otro!.credential);
  });

  /** Y vence: la de hoy no sirve mañana. */
  it('la credencial cambia con el tiempo', () => {
    const ahora = turnCredential('u1', new Date('2026-08-24T12:00:00Z'));
    const mañana = turnCredential('u1', new Date('2026-08-25T12:00:00Z'));

    expect(ahora!.credential).not.toBe(mañana!.credential);
  });

  /**
   * El SECRETO nunca sale. Si viajara, el cliente podría fabricarse
   * credenciales eternas y el vencimiento no serviría de nada.
   */
  it('el secreto no aparece en lo que se entrega', () => {
    const cred = turnCredential('u1', new Date('2026-08-24T12:00:00Z'));

    expect(JSON.stringify(cred)).not.toContain('secreto-de-prueba');
  });

  it('sin TURN configurado devuelve null, no una credencial rota', () => {
    delete process.env.TURN_SECRET;

    expect(turnCredential('u1', new Date())).toBeNull();
  });
});

describe('buildIceServers', () => {
  /**
   * STUN SIEMPRE, TURN si está configurado.
   *
   * Con STUN solo, dos personas en la misma casa se conectan directo y no se
   * gasta un byte del servidor. El TURN es el plan B para cuando el NAT no
   * deja: si faltara, esas llamadas simplemente no conectan.
   */
  it('incluye STUN y TURN cuando hay TURN', () => {
    const servers = buildIceServers('u1');

    expect(servers[0]?.urls).toContain('stun:');
    expect(servers.some((server) => String(server.urls).startsWith('turn:'))).toBe(true);
  });

  it('sin TURN configurado igual entrega STUN', () => {
    delete process.env.TURN_SECRET;

    const servers = buildIceServers('u1');

    expect(servers).toHaveLength(1);
    expect(servers[0]?.urls).toContain('stun:');
  });
});
