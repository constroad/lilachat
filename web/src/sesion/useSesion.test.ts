import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSesion } from './useSesion';

/**
 * El arranque con sesión guardada (W3a, 19/10): hasta que la cookie se canjea
 * no hay token, y lo que se pida en ese rato vuelve 401. Esos 401 NO son una
 * sesión vencida: esperan la misma renovación. Antes, el segundo cerraba la
 * sesión —y en una web vinculada, la desvinculaba—.
 */
const PERFIL = { userId: 'u1', phone: '902049935', name: 'José', deviceId: 'vinculado-1' };

let salidas = 0;
let renovaciones = 0;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('lilachat.perfil', JSON.stringify(PERFIL));
  salidas = 0;
  renovaciones = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/auth/salir')) {
        salidas += 1;
        return new Response(null, { status: 204 });
      }
      if (String(url).includes('/auth/session')) {
        renovaciones += 1;
        await new Promise((listo) => setTimeout(listo, 50));
        return new Response(JSON.stringify({ jwt: `jwt-${renovaciones}` }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('useSesion: los 401 del arranque', () => {
  it('dos 401 sin token todavía esperan la MISMA renovación y no cierran la sesión', async () => {
    const { result } = renderHook(() => useSesion());
    let tokens: (string | null)[] = [];
    await act(async () => {
      tokens = await Promise.all([result.current.manejar401(), result.current.manejar401()]);
    });
    expect(tokens).toEqual(['jwt-1', 'jwt-1']);
    expect(renovaciones).toBe(1);
    expect(salidas).toBe(0);
    expect(localStorage.getItem('lilachat.perfil')).not.toBeNull();
  });

  it('con token: un 401 renueva; otro con el MISMO token sí cierra (revocado de verdad)', async () => {
    const { result } = renderHook(() => useSesion());
    await waitFor(() => expect(result.current.credential?.jwt).toBe('jwt-1'));
    const conElTokenUno = result.current.manejar401;
    await act(async () => {
      expect(await conElTokenUno()).toBe('jwt-2');
    });
    await act(async () => {
      expect(await conElTokenUno()).toBeNull();
    });
    expect(salidas).toBe(1);
  });
});
