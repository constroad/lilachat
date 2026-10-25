import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOutsideMentionsWeb } from './useOutsideMentionsWeb';

afterEach(() => vi.unstubAllGlobals());

const CARLA = { userId: 'u-carla', nombre: 'Carla', outsideChat: true };
const BETO = { userId: 'u-beto', nombre: 'Beto', outsideChat: true };

function mount(answers: Record<string, { status: number; message?: string }> = {}) {
  const requests: { url: string; body: { userId?: string } }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { userId?: string };
      requests.push({ url, body });
      const answer = answers[body.userId ?? ''] ?? { status: 200 };
      return new Response(JSON.stringify(answer.status === 200 ? { ok: true } : { message: answer.message }), { status: answer.status });
    })
  );
  const hook = renderHook(() => useOutsideMentionsWeb({ jwt: 'jwt', chatId: 'c1' }));
  return { ...hook, requests };
}

describe('useOutsideMentionsWeb', () => {
  it('has no prompt until a message mentioned someone outside', () => {
    const { result } = mount();
    expect(result.current.prompt).toBeNull();
  });

  it('after the message, it names them and offers to add them', () => {
    const { result } = mount();
    act(() => result.current.notify([CARLA]));
    expect(result.current.prompt).toMatchObject({ message: 'Carla no está en este canal, así que no recibió tu mención.', action: 'Agregar al canal' });
  });

  it('adding calls the chat members route once per person and clears the prompt', async () => {
    const { result, requests } = mount();
    act(() => result.current.notify([CARLA, BETO]));
    await act(() => result.current.add());
    expect(requests).toEqual([
      { url: '/api/chats/c1/members', body: { userId: 'u-carla' } },
      { url: '/api/chats/c1/members', body: { userId: 'u-beto' } },
    ]);
    expect(result.current.prompt).toBeNull();
    expect(result.current.done).toBe('2 personas se agregaron al canal.');
  });

  it('a refusal keeps the prompt for whoever failed and says why, as the server said it', async () => {
    const { result } = mount({ 'u-beto': { status: 403, message: 'Solo los admins agregan personas a este canal.' } });
    act(() => result.current.notify([CARLA, BETO]));
    await act(() => result.current.add());
    expect(result.current.prompt?.message).toContain('Beto');
    expect(result.current.prompt?.message).not.toContain('Carla');
    expect(result.current.error).toBe('Solo los admins agregan personas a este canal.');
    expect(result.current.done).toBe('Carla se agregó al canal.');
  });

  it('«Ahora no» dismisses it', () => {
    const { result } = mount();
    act(() => result.current.notify([CARLA]));
    act(() => result.current.dismiss());
    expect(result.current.prompt).toBeNull();
  });

  it('changing chat drops the prompt of the other one', () => {
    const { result, rerender } = renderHook((props: { chatId: string }) => useOutsideMentionsWeb({ jwt: 'jwt', chatId: props.chatId }), { initialProps: { chatId: 'c1' } });
    act(() => result.current.notify([CARLA]));
    rerender({ chatId: 'c2' });
    expect(result.current.prompt).toBeNull();
  });
});
