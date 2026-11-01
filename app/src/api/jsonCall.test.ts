import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonCall } from './jsonCall';

const answer = (status: number, body: string) => vi.fn(async () => new Response(status === 204 ? null : body, { status }));

afterEach(() => vi.unstubAllGlobals());

describe('a 2xx is a success only when its body arrived (01/11: «Algo se rompió en esta pantalla»)', () => {
  it('reads the JSON the server sent', async () => {
    // Arrange
    vi.stubGlobal('fetch', answer(200, '{"workspaces":[]}'));
    // Act / Assert
    expect(await jsonCall('https://x/api/workspaces', 'jwt')).toEqual({ ok: true, data: { workspaces: [] } });
  });

  it('a 204 or an empty body is still a success', async () => {
    vi.stubGlobal('fetch', answer(204, ''));
    expect(await jsonCall('https://x/api/push', 'jwt')).toEqual({ ok: true, data: {} });
  });

  it('an HTML page or a cut body is no connection, not an empty object', async () => {
    // Arrange
    vi.stubGlobal('fetch', answer(200, '<html>portal del wifi</html>'));
    // Act
    const html = await jsonCall('https://x/api/workspaces', 'jwt');
    vi.stubGlobal('fetch', answer(200, '{"workspaces":[{"id"'));
    const cut = await jsonCall('https://x/api/workspaces', 'jwt');
    // Assert
    expect(html).toMatchObject({ ok: false });
    expect(cut).toMatchObject({ ok: false });
  });

  it('a refusal still carries the server message', async () => {
    vi.stubGlobal('fetch', answer(403, '{"message":"Sin acceso"}'));
    expect(await jsonCall('https://x/api/workspaces', 'jwt')).toEqual({ ok: false, message: 'Sin acceso', status: 403 });
  });
});
