import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditarChat } from './useEditarChat';

afterEach(() => vi.unstubAllGlobals());

function montar(status = 200, mensaje = 'No se pudo.') {
  const pedidos: { url: string; method: string; body?: unknown; esFormulario?: boolean }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const esFormulario = init?.body instanceof FormData;
      pedidos.push({ url, method: init?.method ?? 'GET', esFormulario, body: init?.body && !esFormulario ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(status === 200 ? { ok: true } : { message: mensaje }), { status });
    })
  );
  const onCambio = vi.fn();
  const onAviso = vi.fn();
  const { result } = renderHook(() => useEditarChat({ chatId: 'c1', jwt: 'jwt', onCambio, onAviso }));
  return { result, pedidos, onCambio, onAviso };
}

describe('useEditarChat', () => {
  it('renombrar valida antes de pedir y manda el nombre limpio', async () => {
    const { result, pedidos, onCambio, onAviso } = montar();
    await act(async () => expect(await result.current.renombrar('   ')).toBe(false));
    expect(pedidos).toHaveLength(0);
    expect(onAviso).toHaveBeenCalled();
    await act(async () => expect(await result.current.renombrar('  Familia  ')).toBe(true));
    expect(pedidos[0]).toMatchObject({ url: '/api/chats/c1', method: 'PATCH', body: { name: 'Familia' } });
    expect(onCambio).toHaveBeenCalled();
  });

  it('la foto va como archivo (FormData)', async () => {
    const { result, pedidos } = montar();
    await act(() => result.current.cambiarFoto(new File(['x'], 'grupo.png', { type: 'image/png' })));
    expect(pedidos[0]).toMatchObject({ url: '/api/chats/c1/avatar', method: 'POST', esFormulario: true });
  });

  it('sumar, nombrar admin y sacar van a sus rutas', async () => {
    const { result, pedidos } = montar();
    await act(() => result.current.agregar('ana'));
    await act(() => result.current.cambiarRol('ana', 'admin'));
    await act(() => result.current.sacar('ana'));
    expect(pedidos.map((uno) => `${uno.method} ${uno.url}`)).toEqual(['POST /api/chats/c1/members', 'PATCH /api/chats/c1/members/ana', 'DELETE /api/chats/c1/members/ana']);
    expect(pedidos[0]?.body).toEqual({ userId: 'ana' });
    expect(pedidos[1]?.body).toEqual({ role: 'admin' });
  });

  it('el motivo del server se muestra (no un «no» mudo)', async () => {
    const { result, onAviso, onCambio } = montar(400, 'Entre admins no se sacan.');
    await act(() => result.current.sacar('mama'));
    expect(onAviso).toHaveBeenCalledWith('Entre admins no se sacan.');
    expect(onCambio).not.toHaveBeenCalled();
  });
});
