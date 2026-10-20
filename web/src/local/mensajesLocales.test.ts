import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BaseLocal } from './baseLocal';
import {
  aplicarReacciones,
  aplicarResumenDeHilo,
  aplicarBorrado,
  aplicarEdicion,
  aplicarEntrante,
  cursoresLocales,
  guardarChats,
  guardarPagina,
  mensajesDelChat,
} from './mensajesLocales';
import type { ChatMessage, ChatSummary } from '../chat/types';

let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`test-${(numero += 1)}`));

afterEach(async () => {
  base.close();
  await base.delete();
});

const mensaje = (seq: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  chatId: 'c1',
  seq,
  senderId: 'u1',
  clientKey: `k${seq}`,
  kind: 'text',
  body: `hola ${seq}`,
  at: '2026-10-19T15:00:00.000Z',
  ...extra,
});

const chat = (id: string): ChatSummary => ({
  id,
  kind: 'direct',
  memberIds: ['u1', 'u2'],
  lastSeq: 0,
  unread: 0,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
});

describe('guardarChats', () => {
  it('el server MANDA: un chat que ya no viene desaparece', async () => {
    nuevaBase();
    await guardarChats(base, [chat('a'), chat('b')]);

    await guardarChats(base, [chat('b')]);

    expect((await base.chats.toArray()).map((c) => c.id)).toEqual(['b']);
  });
});

describe('guardarPagina y mensajesDelChat', () => {
  it('guarda y devuelve los últimos N en orden', async () => {
    nuevaBase();
    await guardarPagina(base, 'c1', [mensaje(1), mensaje(2), mensaje(3)]);

    const ultimos = await mensajesDelChat(base, 'c1', 2);

    expect(ultimos.map((m) => m.seq)).toEqual([2, 3]);
  });

  it('no mezcla chats', async () => {
    nuevaBase();
    await guardarPagina(base, 'c1', [mensaje(1)]);
    await guardarPagina(base, 'c2', [mensaje(1, { chatId: 'c2' })]);

    expect(await mensajesDelChat(base, 'c1', 50)).toHaveLength(1);
  });

  it('lo que el server ya no tiene dentro del rango de la página se borra', async () => {
    // José, 30/08: líneas borradas en la base que seguían en cada teléfono.
    nuevaBase();
    await guardarPagina(base, 'c1', [mensaje(1), mensaje(2), mensaje(3)]);

    await guardarPagina(base, 'c1', [mensaje(1), mensaje(3)], 3);

    expect((await mensajesDelChat(base, 'c1', 50)).map((m) => m.seq)).toEqual([1, 3]);
  });

  it('una página vacía no borra nada', async () => {
    nuevaBase();
    await guardarPagina(base, 'c1', [mensaje(1)]);

    await guardarPagina(base, 'c1', [], 1);

    expect(await mensajesDelChat(base, 'c1', 50)).toHaveLength(1);
  });

  it('lo guardado por encima del último del server no existe', async () => {
    nuevaBase();
    await guardarPagina(base, 'c1', [mensaje(1), mensaje(2), mensaje(7)]);

    await guardarPagina(base, 'c1', [mensaje(1), mensaje(2)], 2);

    expect((await mensajesDelChat(base, 'c1', 50)).map((m) => m.seq)).toEqual([1, 2]);
  });
});

describe('aplicarEntrante', () => {
  it('el eco de msg.new pisa la misma fila: no duplica', async () => {
    nuevaBase();
    await aplicarEntrante(base, mensaje(5));
    await aplicarEntrante(base, mensaje(5, { body: 'hola 5' }));

    expect(await mensajesDelChat(base, 'c1', 50)).toHaveLength(1);
  });

  it('saca de la cola el envío propio con el mismo clientKey', async () => {
    nuevaBase();
    await base.cola.put({ clientKey: 'k9', chatId: 'c1', kind: 'text', body: 'yo', queuedAt: '2026-10-19T15:00:00.000Z', attempts: 0 });

    await aplicarEntrante(base, mensaje(9));

    expect(await base.cola.count()).toBe(0);
  });
});

describe('borrar y editar', () => {
  it('el borrado deja la lápida, sin el texto', async () => {
    nuevaBase();
    await aplicarEntrante(base, mensaje(4));

    await aplicarBorrado(base, { chatId: 'c1', seq: 4, deletedAt: '2026-10-19T16:00:00.000Z' });

    const [borrado] = await mensajesDelChat(base, 'c1', 50);
    expect(borrado?.body).toBeUndefined();
    expect(borrado?.deletedAt).toBe('2026-10-19T16:00:00.000Z');
  });

  it('la edición cambia el texto y marca «Editado»', async () => {
    nuevaBase();
    await aplicarEntrante(base, mensaje(4));

    await aplicarEdicion(base, { chatId: 'c1', seq: 4, body: 'corregido', editedAt: '2026-10-19T16:00:00.000Z' });

    const [editado] = await mensajesDelChat(base, 'c1', 50);
    expect(editado?.body).toBe('corregido');
    expect(editado?.editedAt).toBe('2026-10-19T16:00:00.000Z');
  });

  it('borrar o editar uno que no está no inventa nada', async () => {
    nuevaBase();

    await aplicarBorrado(base, { chatId: 'c1', seq: 99, deletedAt: '2026-10-19T16:00:00.000Z' });

    expect(await base.mensajes.count()).toBe(0);
  });
});

describe('cursoresLocales', () => {
  it('el seq más alto que tengo de cada chat, para pedir solo lo que falta', async () => {
    nuevaBase();
    await guardarChats(base, [chat('c1'), chat('c2')]);
    await guardarPagina(base, 'c1', [mensaje(3), mensaje(8)]);

    expect(await cursoresLocales(base)).toEqual({ c1: 8 });
  });
});

/** E3 (20/10): el chip de la raíz al día en la base local. */
describe('aplicarResumenDeHilo', () => {
  it('pone el resumen en la raíz y no toca lo demás', async () => {
    const base = new BaseLocal(`hilos-${Math.random()}`);
    await base.mensajes.bulkPut([
      { chatId: 'c', seq: 1, senderId: 'a', clientKey: 'k1', kind: 'text', body: 'raíz', at: 'x' },
      { chatId: 'c', seq: 2, senderId: 'b', clientKey: 'k2', kind: 'text', body: 'r', at: 'x', hiloDe: 1 },
    ]);
    await aplicarResumenDeHilo(base, { chatId: 'c', raiz: 1, hilo: { respuestas: 1, ultimaSeq: 2 } });
    expect((await base.mensajes.get(['c', 1]))?.hilo).toEqual({ respuestas: 1, ultimaSeq: 2 });
    expect((await base.mensajes.get(['c', 2]))?.hilo).toBeUndefined();
    base.close();
    await base.delete();
  });
});

/** Reacciones (20/10): la lista del server reemplaza la guardada. */
describe('aplicarReacciones', () => {
  it('pone la lista nueva en ese mensaje y no toca los demás', async () => {
    const base = new BaseLocal(`reacciones-${Math.random()}`);
    await base.mensajes.bulkPut([
      { chatId: 'c', seq: 1, senderId: 'a', clientKey: 'k1', kind: 'text', body: 'uno', at: 'x', reacciones: [{ userId: 'b', emoji: '❤️' }] },
      { chatId: 'c', seq: 2, senderId: 'b', clientKey: 'k2', kind: 'text', body: 'dos', at: 'x' },
    ]);
    await aplicarReacciones(base, { chatId: 'c', seq: 1, reacciones: [{ userId: 'b', emoji: '❤️' }, { userId: 'a', emoji: '👍' }] });
    expect((await base.mensajes.get(['c', 1]))?.reacciones).toEqual([{ userId: 'b', emoji: '❤️' }, { userId: 'a', emoji: '👍' }]);
    expect((await base.mensajes.get(['c', 2]))?.reacciones).toBeUndefined();
    base.close();
    await base.delete();
  });
});
