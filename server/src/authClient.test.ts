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

  it('a refusal keeps the service\'s code', async () => {
    vi.stubGlobal('fetch', answer(JSON.stringify({ codigo: 'revocado' }), 401));
    expect(await buildHttpAuthClient().validateDevice('d1', 's1')).toEqual({ ok: false, codigo: 'revocado' });
  });
});
