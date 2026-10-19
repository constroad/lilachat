import 'fake-indexeddb/auto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseLocal } from '../local/baseLocal';
import type { ChatSummary } from '../chat/types';
import { useAccionesSobreChats } from './accionesSobreChats';

let base: BaseLocal;
let numero = 0;
const chat = (extra: Partial<ChatSummary> = {}): ChatSummary => ({
  id: '6650f1c2a3b4c5d6e7f80911',
  kind: 'direct',
  name: 'Ana',
  memberIds: ['yo', 'ana'],
  lastSeq: 9,
  unread: 3,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  ...extra,
});

function montar(respuesta: { status: number; body?: unknown } = { status: 200, body: { ok: true } }) {
  const pedidos: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(respuesta.body ?? {}), { status: respuesta.status });
    })
  );
  const emitir = vi.fn();
  const params = {
    base,
    jwt: 'jwt',
    socket: { current: { emit: emitir } as never },
    cargarChats: vi.fn(async () => undefined),
    invalidarCargas: vi.fn(),
    renovarSesion: vi.fn(async (): Promise<string | null> => 'jwt-nuevo'),
    onAviso: vi.fn(),
    alQuitar: vi.fn(),
  };
  const { result } = renderHook(() => useAccionesSobreChats(params));
  return { result, pedidos, emitir, params };
}

beforeEach(async () => {
  base = new BaseLocal(`acciones-${(numero += 1)}`);
  await base.chats.put(chat());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  base.close();
  await base.delete();
});

describe('useAccionesSobreChats', () => {
  it('archivar: la lista cambia al toque y el server recibe el ajuste', async () => {
    const { result, pedidos, params } = montar();
    await act(() => result.current.aplicar(chat({ pinned: true }), 'archivar'));
    expect(await base.chats.get(chat().id)).toMatchObject({ archived: true, pinned: false });
    expect(pedidos[0]).toMatchObject({ url: `/api/chats/${chat().id}/ajustes`, method: 'PATCH', body: { archived: true, pinned: false } });
    expect(params.cargarChats).toHaveBeenCalled();
    // Lo que estaba en vuelo traía el estado de antes de archivar.
    expect(params.invalidarCargas).toHaveBeenCalled();
  });

  it('si el server rechaza, vuelve atrás y lo dice', async () => {
    const { result, params } = montar({ status: 400, body: { message: 'No estás en esa conversación.' } });
    await act(() => result.current.aplicar(chat(), 'silenciar'));
    expect((await base.chats.get(chat().id))?.muted).toBeUndefined();
    expect(params.onAviso).toHaveBeenCalledWith('No estás en esa conversación.');
  });

  it('marcar como leído: cero sin leer, sin la marca, y el acuse por el socket', async () => {
    await base.chats.put(chat({ markedUnread: true }));
    const { result, emitir } = montar();
    await act(() => result.current.aplicar(chat({ markedUnread: true }), 'leido'));
    expect(await base.chats.get(chat().id)).toMatchObject({ unread: 0, markedUnread: false });
    expect(emitir).toHaveBeenCalledWith('read.set', { chatId: chat().id, seq: 9 });
  });

  it('eliminar: pide borrar-para-mi, lo saca de la base y avisa para cerrar el chat abierto', async () => {
    const { result, pedidos, params } = montar();
    await act(() => result.current.aplicar(chat(), 'eliminar'));
    expect(pedidos[0]).toMatchObject({ url: `/api/chats/${chat().id}/borrar-para-mi`, method: 'POST' });
    expect(await base.chats.get(chat().id)).toBeUndefined();
    expect(params.alQuitar).toHaveBeenCalledWith(chat().id);
  });

  it('salir del grupo: pide leave y relee la lista; el chat sigue (como WhatsApp)', async () => {
    const { result, pedidos, params } = montar();
    await act(() => result.current.aplicar(chat({ kind: 'group' }), 'salir'));
    expect(pedidos[0]).toMatchObject({ url: `/api/chats/${chat().id}/leave`, method: 'POST' });
    expect(params.cargarChats).toHaveBeenCalled();
    expect(await base.chats.get(chat().id)).toBeDefined();
  });

  it('un 401 (token vencido o todavía renovando) renueva la sesión y reintenta UNA vez', async () => {
    const { result, params } = montar();
    const respuestas = [401, 200];
    const autorizaciones: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        autorizaciones.push(new Headers(init?.headers).get('Authorization'));
        return new Response('{}', { status: respuestas.shift() ?? 200 });
      })
    );
    await act(() => result.current.aplicar(chat(), 'silenciar'));
    expect(params.renovarSesion).toHaveBeenCalledTimes(1);
    expect(autorizaciones).toEqual(['Bearer jwt', 'Bearer jwt-nuevo']);
    expect(await base.chats.get(chat().id)).toMatchObject({ muted: true });
    expect(params.onAviso).not.toHaveBeenCalled();
  });

  it('si la renovación no da sesión, vuelve atrás sin reintentar', async () => {
    const { result, params } = montar({ status: 401, body: { message: 'Tu sesión venció. Vuelve a entrar.' } });
    params.renovarSesion.mockResolvedValueOnce(null);
    await act(() => result.current.aplicar(chat(), 'silenciar'));
    expect((await base.chats.get(chat().id))?.muted).toBeUndefined();
  });

  it('sin red al eliminar: no borra nada local y avisa', async () => {
    const { result, params } = montar();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('sin red'))));
    await act(() => result.current.aplicar(chat(), 'eliminar'));
    expect(await base.chats.get(chat().id)).toBeDefined();
    expect(params.onAviso).toHaveBeenCalledWith('Sin conexión. Revisa tu internet.');
  });
});
