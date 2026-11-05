import { describe, expect, it, vi } from 'vitest';
import { listChats } from './client';

vi.mock('./appBuild', () => ({ buildHeader: () => ({}), reportStatus: () => undefined }));

/** José 05/11: «Cannot read property 'filter' of undefined» in the tabs, while a deploy restarted the server. */
const answer = (status: number, body: string) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe('the chat list only counts when it arrived', () => {
  it('reads the list the server sent', async () => {
    expect(await listChats('jwt', answer(200, '{"chats":[]}'))).toEqual({ ok: true, data: { chats: [] } });
  });

  it('a 200 whose body was cut is a failure, not an empty answer', async () => {
    expect(await listChats('jwt', answer(200, '{"chats":[{"id":'))).toEqual({ ok: false, status: 'network' });
  });

  it('a 200 with an HTML page is a failure', async () => {
    expect(await listChats('jwt', answer(200, '<!doctype html><title>Lilachat</title>'))).toEqual({ ok: false, status: 'network' });
  });

  it('a JSON without the list is a failure: the tabs read `chats` while drawing', async () => {
    expect(await listChats('jwt', answer(200, '{}'))).toEqual({ ok: false, status: 'network' });
    expect(await listChats('jwt', answer(200, ''))).toEqual({ ok: false, status: 'network' });
  });

  it('a refusal keeps its status and message', async () => {
    expect(await listChats('jwt', answer(401, '{"message":"Sesión vencida"}'))).toEqual({ ok: false, status: 401, message: 'Sesión vencida' });
  });
});
