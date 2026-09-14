import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obtenerIceServers } from './turnCredentials.js';

/**
 * Los servidores ICE de una llamada (F10), pedidos a Cloudflare Realtime TURN.
 *
 * Lo que importa: el secreto NO viaja al teléfono (esto corre en el server), y si
 * Cloudflare no contesta se **falla cerrado a STUN** —la llamada de misma red
 * igual anda— en vez de dejar sin llamar a todos.
 */
const STUN = 'stun:stun.cloudflare.com:3478';

const RESPUESTA_CF = {
  iceServers: [
    { urls: [STUN] },
    { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' },
  ],
};

describe('obtenerIceServers', () => {
  beforeEach(() => {
    process.env.CF_TURN_KEY_ID = 'key123';
    process.env.CF_TURN_API_TOKEN = 'token123';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CF_TURN_KEY_ID;
    delete process.env.CF_TURN_API_TOKEN;
  });

  it('con credenciales, devuelve el TURN de Cloudflare (con relay)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(RESPUESTA_CF), { status: 201 })
    );
    const servers = await obtenerIceServers();
    expect(servers).toHaveLength(2);
    expect(servers[1]?.credential).toBe('c');
  });

  it('sin CF_TURN_KEY_ID/TOKEN configurados → solo STUN, sin llamar a Cloudflare', async () => {
    delete process.env.CF_TURN_KEY_ID;
    delete process.env.CF_TURN_API_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const servers = await obtenerIceServers();
    expect(servers).toEqual([{ urls: STUN }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('si Cloudflare responde error → falla cerrado a STUN', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    expect(await obtenerIceServers()).toEqual([{ urls: STUN }]);
  });

  it('si el fetch tira (red/timeout) → falla cerrado a STUN', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    expect(await obtenerIceServers()).toEqual([{ urls: STUN }]);
  });
});
