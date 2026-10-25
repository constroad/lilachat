import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMencionesDelCampo } from './useMencionesDelCampo';

const ANA = { id: 'u-ana', nombre: 'Ana' };
const CARLA = { id: 'u-carla', nombre: 'Carla', outsideChat: true };

/** José 25/10: @ in a channel lists the space; someone outside is mentioned but cannot be notified. */
describe('useMencionesDelCampo with people outside the chat', () => {
  it('«@» lists the group mentions, the people of the chat and then the rest of the space', () => {
    const { result } = renderHook(() => useMencionesDelCampo([ANA, CARLA]));
    act(() => result.current.alCambiar('@', 1));
    expect(result.current.opciones.map((one) => one.nombre)).toEqual(['todos', 'aquí', 'Ana', 'Carla']);
  });

  it('choosing someone outside does not send their mention, but reports them once the message leaves', () => {
    const { result } = renderHook(() => useMencionesDelCampo([ANA, CARLA]));
    act(() => result.current.alCambiar('Hola @Ca', 8));
    let completed: { texto: string } | null = null;
    act(() => {
      completed = result.current.elegir('Hola @Ca', CARLA);
    });
    const text = completed!.texto.trim();
    expect(text).toBe('Hola @Carla');
    expect(result.current.mencionesDe(text)).toEqual([]);
    expect(result.current.outside(text)).toEqual([{ userId: 'u-carla', nombre: 'Carla', outsideChat: true }]);
  });

  it('someone of the chat travels as a mention and is not reported', () => {
    const { result } = renderHook(() => useMencionesDelCampo([ANA, CARLA]));
    act(() => result.current.alCambiar('@An', 3));
    let completed: { texto: string } | null = null;
    act(() => {
      completed = result.current.elegir('@An', ANA);
    });
    const text = completed!.texto.trim();
    expect(result.current.mencionesDe(text)).toEqual([{ userId: 'u-ana', desde: 0, largo: 4 }]);
    expect(result.current.outside(text)).toEqual([]);
  });

  it('a chat without people (a 1:1) offers nothing', () => {
    const { result } = renderHook(() => useMencionesDelCampo(undefined));
    act(() => result.current.alCambiar('@', 1));
    expect(result.current.opciones).toEqual([]);
  });
});
