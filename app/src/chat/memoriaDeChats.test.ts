import { describe, expect, it } from 'vitest';
import { MemoriaDeChats } from './memoriaDeChats';

/**
 * FL12 (§49 #2): el chat entraba VACÍO deslizándose y las burbujas llegaban
 * 0,3–0,8 s después (lectura del disco + descifrado). Con los últimos mensajes
 * ya descifrados en memoria, la pantalla nace pintada.
 */
describe('MemoriaDeChats', () => {
  const m = (seq: number) => ({ seq });

  it('devuelve lo recordado, y nada de un chat que no conoce', () => {
    const memoria = new MemoriaDeChats<{ seq: number }>({ chats: 3, mensajes: 5 });
    memoria.recordar('a', [m(1), m(2)]);
    expect(memoria.de('a')).toEqual([m(1), m(2)]);
    expect(memoria.de('b')).toBeNull();
  });

  it('guarda solo los últimos N mensajes de cada chat', () => {
    const memoria = new MemoriaDeChats<{ seq: number }>({ chats: 3, mensajes: 2 });
    memoria.recordar('a', [m(1), m(2), m(3)]);
    expect(memoria.de('a')).toEqual([m(2), m(3)]);
  });

  it('pasado el tope olvida el chat que hace más que no se usa', () => {
    const memoria = new MemoriaDeChats<{ seq: number }>({ chats: 2, mensajes: 5 });
    memoria.recordar('a', [m(1)]);
    memoria.recordar('b', [m(1)]);
    memoria.de('a'); // usar «a» lo vuelve reciente
    memoria.recordar('c', [m(1)]);
    expect(memoria.de('b')).toBeNull();
    expect(memoria.de('a')).not.toBeNull();
    expect(memoria.de('c')).not.toBeNull();
  });

  it('una lista vacía no pisa lo recordado', () => {
    const memoria = new MemoriaDeChats<{ seq: number }>({ chats: 2, mensajes: 5 });
    memoria.recordar('a', [m(1)]);
    memoria.recordar('a', []);
    expect(memoria.de('a')).toEqual([m(1)]);
  });

  it('olvidar un chat, al borrarlo para mí', () => {
    const memoria = new MemoriaDeChats<{ seq: number }>({ chats: 2, mensajes: 5 });
    memoria.recordar('a', [m(1)]);
    memoria.recordar('b', [m(1)]);
    memoria.olvidar('a');
    expect(memoria.de('a')).toBeNull();
    expect(memoria.de('b')).not.toBeNull();
  });

  it('olvidar todo, al cerrar sesión', () => {
    const memoria = new MemoriaDeChats<{ seq: number }>({ chats: 2, mensajes: 5 });
    memoria.recordar('a', [m(1)]);
    memoria.olvidarTodo();
    expect(memoria.de('a')).toBeNull();
  });
});
