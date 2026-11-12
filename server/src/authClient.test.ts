import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHttpAuthClient } from './authClient.js';

/**
 * Production 08/11: constroad-auth answered a 200 with an empty or cut body, the client took it as
 * a success with `valor: null` and `/auth/session` crashed reading `identidad` (unhandledRejection).
 * A 2xx without its JSON object is no answer: «sin_respuesta», which retries and never revokes.
 */
const answer = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }));

beforeEach(() => vi.stubEnv('CONSTROAD_AUTH_KEY', 'test-key'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('constroad-auth client', () => {
  it('a 200 with its object is the answer', async () => {
    vi.stubGlobal('fetch', answer(JSON.stringify({ companyId: 'constroad', identidad: '902000000', app: 'lilachat' })));
    expect(await buildHttpAuthClient().validateDevice('d1', 's1')).toEqual({ ok: true, valor: { companyId: 'constroad', identidad: '902000000', app: 'lilachat' } });
  });

  it('a 200 with an empty, cut or null body is no answer, not a success', async () => {
    for (const body of ['', '{"companyId":"constr', 'null', '"texto"']) {
      vi.stubGlobal('fetch', answer(body));
      expect(await buildHttpAuthClient().validateDevice('d1', 's1')).toEqual({ ok: false, codigo: 'sin_respuesta' });
    }
  });

  /** José 12/11: the invitation goes from Lilachat; its button is the callback with the email (`?d=`), which the key declares. */
  it('the invitation goes to /v1/invitaciones with the space, who invites and the callback as the link', async () => {
    // Arrange
    let sent: { url: string; body: unknown } | null = null;
    vi.stubEnv('CONSTROAD_AUTH_CALLBACK', 'http://localhost:4004/login/callback');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ ok: true, canal: 'email' }));
    }));
    // Act
    const outcome = await buildHttpAuthClient().sendInvitation({ to: 'luis@empresa.pe', spaceName: 'Test', inviterName: 'José Zamora', role: 'Supervisor' });
    // Assert
    expect(outcome).toEqual({ ok: true, valor: { ok: true, canal: 'email' } });
    expect(sent).toEqual({
      url: 'https://auth.constroad.com/v1/invitaciones',
      body: { companyId: 'constroad', destino: 'luis@empresa.pe', espacio: 'Test', rol: 'Supervisor', invitadoPor: 'José Zamora', enlaceBase: 'http://localhost:4004/login/callback' },
    });
  });

  it('a refusal keeps the service\'s code', async () => {
    vi.stubGlobal('fetch', answer(JSON.stringify({ codigo: 'revocado' }), 401));
    expect(await buildHttpAuthClient().validateDevice('d1', 's1')).toEqual({ ok: false, codigo: 'revocado' });
  });
});
