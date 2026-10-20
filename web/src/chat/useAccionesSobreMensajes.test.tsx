import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAccionesSobreMensajes, type AccionesDeSync } from './useAccionesSobreMensajes';
import type { MensajeEnPantalla } from './types';

const mensaje = (seq: number, body = `m${seq}`): MensajeEnPantalla => ({ chatId: 'c1', seq, senderId: 'u2', clientKey: `k${seq}`, kind: 'text', body, at: '2026-10-19T18:00:00.000Z' });

function preparar() {
  const sync: AccionesDeSync = {
    enviarTexto: vi.fn(async () => undefined),
    editar: vi.fn(async () => ({ ok: true as const })),
    reaccionar: vi.fn(async () => ({ ok: true as const })),
    eliminarParaTodos: vi.fn(async () => ({ ok: true as const })),
    eliminarParaMi: vi.fn(async () => undefined),
    reenviar: vi.fn(async () => undefined),
    avisarEscribiendo: vi.fn(),
  };
  const avisos: string[] = [];
  const hook = renderHook(({ chatId }) => useAccionesSobreMensajes({ chatId, sync, nombres: new Map([['u2', 'Ana']]), onAviso: (t) => avisos.push(t) }), { initialProps: { chatId: 'c1' as string | null } });
  return { sync, avisos, hook };
}

describe('useAccionesSobreMensajes', () => {
  it('responder: la franja dice a quién, y lo enviado lleva el replyToSeq', async () => {
    const { sync, hook } = preparar();

    act(() => hook.result.current.onAccion(mensaje(7), 'responder'));
    expect(hook.result.current.contexto).toMatchObject({ tipo: 'respuesta', titulo: 'Respondiendo a Ana', texto: 'm7' });
    await act(() => hook.result.current.enviar('dale'));

    expect(sync.enviarTexto).toHaveBeenCalledWith('c1', 'dale', { replyToSeq: 7 });
    expect(hook.result.current.contexto).toBeNull();
  });

  it('editar: lo enviado edita ese mensaje, no manda uno nuevo', async () => {
    const { sync, hook } = preparar();

    act(() => hook.result.current.onAccion(mensaje(3, 'hola'), 'editar'));
    await act(() => hook.result.current.enviar('hola!'));

    expect(sync.editar).toHaveBeenCalledWith('c1', 3, 'hola!');
    expect(sync.enviarTexto).not.toHaveBeenCalled();
  });

  it('editar sin cambiar nada no le pregunta al server', async () => {
    const { sync, hook } = preparar();

    act(() => hook.result.current.onAccion(mensaje(3, 'hola'), 'editar'));
    await act(() => hook.result.current.enviar('hola'));

    expect(sync.editar).not.toHaveBeenCalled();
  });

  it('si el server no deja editar, avisa el motivo', async () => {
    const { sync, avisos, hook } = preparar();
    vi.mocked(sync.editar).mockResolvedValueOnce({ ok: false, motivo: 'Pasaron más de 15 minutos: ya no se puede editar.' });

    act(() => hook.result.current.onAccion(mensaje(3, 'hola'), 'editar'));
    await act(() => hook.result.current.enviar('chau'));

    expect(avisos).toEqual(['Pasaron más de 15 minutos: ya no se puede editar.']);
  });

  it('cambiar de chat suelta la respuesta a medias', () => {
    const { hook } = preparar();

    act(() => hook.result.current.onAccion(mensaje(7), 'responder'));
    hook.rerender({ chatId: 'c2' });

    expect(hook.result.current.contexto).toBeNull();
  });
});
