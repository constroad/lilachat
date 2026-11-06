import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

/** José 05/11: a body cut by a server restart read as `{}`, and the screen then read a list that was not there. */
const answer = (status: number, body: string | null) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));

afterEach(() => vi.unstubAllGlobals());

describe('a 2xx is a success only when its body arrived', () => {
  it('reads the JSON the server sent', async () => {
    answer(200, '{"chats":[]}');
    expect(await api('/chats')).toEqual({ ok: true, data: { chats: [] } });
  });

  it('a body that was cut is a failure, said as no connection', async () => {
    answer(200, '{"chats":[{"id":');
    expect(await api('/chats')).toEqual({ ok: false, status: 0, message: 'Sin conexión. Revisa tu internet.' });
  });

  it('an HTML page is a failure', async () => {
    answer(200, '<!doctype html>');
    expect((await api('/chats')).ok).toBe(false);
  });

  it('a 204 and an empty 200 are still a success', async () => {
    answer(204, null);
    expect((await api('/x', { method: 'DELETE' })).ok).toBe(true);
    answer(200, '');
    expect((await api('/x', { method: 'POST' })).ok).toBe(true);
  });

  it('a refusal keeps its message', async () => {
    answer(403, '{"message":"No puedes"}');
    expect(await api('/x')).toEqual({ ok: false, status: 403, message: 'No puedes' });
  });
});

describe('a call that needs the session, before the session is ready', () => {
  it('does not go out: it answered 401 three times on every load (06/11)', async () => {
    // Arrange
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    // Act
    const result = await api('/agenda/queue?chatId=c1', { jwt: '' });
    // Assert
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, status: 401 });
    vi.unstubAllGlobals();
  });
});

