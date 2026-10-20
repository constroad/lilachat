import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFijarEnLaWeb } from './useFijarEnLaWeb';

afterEach(() => vi.unstubAllGlobals());

function montar(status = 200) {
  const pedidos: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(status === 200 ? { ok: true } : { message: 'En un grupo, solo los admins fijan mensajes.' }), { status });
    })
  );
  const onAviso = vi.fn();
  const onCambio = vi.fn();
  const { result } = renderHook(() => useFijarEnLaWeb({ chatId: 'c1', jwt: 'jwt', onAviso, onCambio }));
  return { result, pedidos, onAviso, onCambio };
}

describe('useFijarEnLaWeb', () => {
  it('pedir abre la duración; fijar manda seq y duración y relee', async () => {
    const { result, pedidos, onCambio } = montar();
    act(() => result.current.pedir(7));
    expect(result.current.pidiendo).toBe(7);
    await act(() => result.current.fijar('30d'));
    expect(result.current.pidiendo).toBeNull();
    expect(pedidos[0]).toMatchObject({ url: '/api/chats/c1/fijados', method: 'POST', body: { seq: 7, duracion: '30d' } });
    expect(onCambio).toHaveBeenCalled();
  });

  it('desfijar pide DELETE; un rechazo se dice', async () => {
    const { result, pedidos, onAviso } = montar(403);
    await act(() => result.current.desfijar(7));
    expect(pedidos[0]).toMatchObject({ url: '/api/chats/c1/fijados/7', method: 'DELETE' });
    expect(onAviso).toHaveBeenCalledWith('En un grupo, solo los admins fijan mensajes.');
  });
});
