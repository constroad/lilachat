import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Credential } from '../api';
import { useVinculacionPorQr, type ServicioDeVinculacion } from './useVinculacionPorQr';
import type { ResultadoDeEspera, Vinculacion } from './vinculacionPorQr';

const VINCULACION: Vinculacion = { id: 'v1', clave: 'clave-privada', token: 'token-1', rotarCadaMs: 40 };
const CREDENCIAL: Credential = { jwt: 'jwt', deviceId: 'vinculado-1', userId: 'u1', phone: '902049935', name: 'José' };

/** Un servicio falso: `esperar` devuelve lo que diga la cola, o «pendiente» tras un rato. */
function servicioFalso(respuestas: ResultadoDeEspera[] = []) {
  const senales: AbortSignal[] = [];
  let rotaciones = 0;
  const servicio: ServicioDeVinculacion = {
    iniciar: vi.fn(async () => ({ ok: true as const, vinculacion: { ...VINCULACION } })),
    rotar: vi.fn(async () => ({ token: `token-${(rotaciones += 1) + 1}` })),
    esperar: vi.fn(async (_vinculacion: Vinculacion, _mantener: boolean, signal: AbortSignal) => {
      senales.push(signal);
      const siguiente = respuestas.shift();
      if (siguiente) return siguiente;
      await new Promise((listo) => setTimeout(listo, 20));
      return { estado: 'pendiente' as const };
    }),
  };
  return { servicio, senales };
}

const ponerVisibilidad = (estado: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => ponerVisibilidad('visible'));

describe('useVinculacionPorQr', () => {
  it('muestra el QR y entra cuando el teléfono aprueba', async () => {
    const { servicio } = servicioFalso([{ estado: 'pendiente' }, { estado: 'vinculada', credential: CREDENCIAL }]);
    const onReady = vi.fn();
    const { result } = renderHook(() => useVinculacionPorQr({ onReady, mantener: true, servicio }));

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(CREDENCIAL));
    expect(result.current.estado.fase).toBe('entrando');
    expect(servicio.esperar).toHaveBeenCalledWith(expect.objectContaining({ clave: 'clave-privada' }), true, expect.anything());
  });

  it('rota el token solo mientras la pestaña está al frente', async () => {
    const { servicio } = servicioFalso();
    const { result } = renderHook(() => useVinculacionPorQr({ onReady: vi.fn(), mantener: true, servicio }));
    // Rotated at least once: under load (the gates run every suite at once) it can already be on the third token.
    await waitFor(() => expect(result.current.estado).toMatchObject({ fase: 'mostrando', token: expect.stringMatching(/^token-([2-9]|\d{2,})$/) }));

    act(() => ponerVisibilidad('hidden'));
    const rotacionesAlOcultar = vi.mocked(servicio.rotar).mock.calls.length;
    await new Promise((listo) => setTimeout(listo, 150));
    expect(vi.mocked(servicio.rotar).mock.calls.length).toBe(rotacionesAlOcultar);
  });

  it('oculta la pestaña: corta la espera en curso (el server no canjea para nadie)', async () => {
    const { servicio, senales } = servicioFalso();
    renderHook(() => useVinculacionPorQr({ onReady: vi.fn(), mantener: true, servicio }));
    await waitFor(() => expect(senales.length).toBeGreaterThan(0));
    act(() => ponerVisibilidad('hidden'));
    await waitFor(() => expect(senales.at(-1)?.aborted).toBe(true));
  });

  it('vencida: pide generar otro, y generar vuelve a empezar', async () => {
    const { servicio } = servicioFalso([{ estado: 'vencida' }]);
    const { result } = renderHook(() => useVinculacionPorQr({ onReady: vi.fn(), mantener: true, servicio }));
    await waitFor(() => expect(result.current.estado.fase).toBe('vencido'));

    await act(async () => result.current.generar());
    await waitFor(() => expect(result.current.estado.fase).toBe('mostrando'));
    expect(servicio.iniciar).toHaveBeenCalledTimes(2);
  });

  it('si rotar dice que venció, también queda vencido', async () => {
    const { servicio } = servicioFalso();
    vi.mocked(servicio.rotar).mockResolvedValue({ vencida: true });
    const { result } = renderHook(() => useVinculacionPorQr({ onReady: vi.fn(), mantener: true, servicio }));
    await waitFor(() => expect(result.current.estado.fase).toBe('vencido'));
  });

  it('un rechazo del server (tope de 4) se muestra con su motivo', async () => {
    const motivo = 'Ya tienes 4 dispositivos vinculados.';
    const { servicio } = servicioFalso([{ estado: 'error', motivo, sinRed: false }]);
    const { result } = renderHook(() => useVinculacionPorQr({ onReady: vi.fn(), mantener: true, servicio }));
    await waitFor(() => expect(result.current.estado).toEqual({ fase: 'error', motivo }));
  });

  it('sin red al pedir el QR: error con reintento', async () => {
    const { servicio } = servicioFalso();
    vi.mocked(servicio.iniciar).mockResolvedValueOnce({ ok: false, motivo: 'Sin conexión. Revisa tu internet.' });
    const { result } = renderHook(() => useVinculacionPorQr({ onReady: vi.fn(), mantener: true, servicio }));
    await waitFor(() => expect(result.current.estado).toEqual({ fase: 'error', motivo: 'Sin conexión. Revisa tu internet.' }));
    await act(async () => result.current.generar());
    await waitFor(() => expect(result.current.estado.fase).toBe('mostrando'));
  });

  it('«Mantener la sesión iniciada» se lee al canjear, no al montar', async () => {
    const { servicio } = servicioFalso();
    const { rerender } = renderHook((props: { mantener: boolean }) => useVinculacionPorQr({ onReady: vi.fn(), mantener: props.mantener, servicio }), {
      initialProps: { mantener: true },
    });
    rerender({ mantener: false });
    await waitFor(() => expect(vi.mocked(servicio.esperar).mock.calls.some((llamada) => llamada[1] === false)).toBe(true));
  });
});
