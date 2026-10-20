import { describe, expect, it } from 'vitest';
import { addMissingBySeq, MemoriaDeChats } from './memoriaDeChats';

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

/**
 * Scroll on re-entering a chat (José, 20/10: «the scroll keeps going and
 * flickers»): the memory copy was older than the disk — messages that arrived
 * with the chat closed went to disk only — and the server check appended them
 * after the list was placed. The memory has to follow every disk write.
 */
describe('MemoriaDeChats keeps up with the disk', () => {
  const message = (seq: number, body = `m${seq}`) => ({ seq, body });

  it('add merges by seq, keeps the limit and the newest', () => {
    const memory = new MemoriaDeChats<{ seq: number; body: string }>({ chats: 3, mensajes: 3 });
    memory.recordar('a', [message(1), message(2)]);
    memory.add('a', [message(3), message(4), message(2, 'edited')]);
    expect(memory.de('a')).toEqual([message(2, 'edited'), message(3), message(4)]);
  });

  it('add does not create a chat (useChat would start with one row and skip the disk)', () => {
    const memory = new MemoriaDeChats<{ seq: number; body: string }>({ chats: 3, mensajes: 3 });
    memory.add('b', [message(1)]);
    expect(memory.de('b')).toBeNull();
  });

  it('add does not refresh the least-recently-used order', () => {
    const memory = new MemoriaDeChats<{ seq: number; body: string }>({ chats: 2, mensajes: 5 });
    memory.recordar('a', [message(1)]);
    memory.recordar('b', [message(1)]);
    memory.add('a', [message(2)]);
    memory.recordar('c', [message(1)]);
    expect(memory.de('a')).toBeNull();
    expect(memory.de('b')).not.toBeNull();
  });

  it('add with nothing new keeps the same array (no re-render)', () => {
    const memory = new MemoriaDeChats<{ seq: number; body: string }>({ chats: 3, mensajes: 5 });
    const first = [message(1), message(2)];
    memory.recordar('a', first);
    const before = memory.de('a');
    memory.add('a', [message(2)]);
    expect(memory.de('a')).toBe(before);
  });

  it('drop removes what the disk removed', () => {
    const memory = new MemoriaDeChats<{ seq: number; body: string }>({ chats: 3, mensajes: 5 });
    memory.recordar('a', [message(1), message(2), message(3)]);
    memory.drop('a', [2]);
    expect(memory.de('a')).toEqual([message(1), message(3)]);
    memory.drop('missing', [1]);
    expect(memory.de('missing')).toBeNull();
  });
});

describe('addMissingBySeq (safety net when memory and disk disagree, e.g. offline)', () => {
  const message = (seq: number, body = `m${seq}`) => ({ seq, body });

  it('adds only the seqs the screen does not have, in order, keeping what it has', () => {
    const current = [message(1), message(3, 'mine')];
    expect(addMissingBySeq(current, [message(2), message(3, 'disk'), message(4)])).toEqual([message(1), message(2), message(3, 'mine'), message(4)]);
  });

  it('returns the same array when nothing is missing (no re-render, no scroll)', () => {
    const current = [message(1), message(2)];
    expect(addMissingBySeq(current, [message(2)])).toBe(current);
  });
});
