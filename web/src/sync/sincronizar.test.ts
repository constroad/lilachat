import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Cursors } from '@lilachat/shared';
import { BaseLocal } from '../local/baseLocal';
import { guardarChats, guardarPagina, mensajesDelChat } from '../local/mensajesLocales';
import { sincronizar } from './sincronizar';
import type { ChatMessage, ChatSummary } from '../chat/types';

let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`sync-${(numero += 1)}`));

afterEach(async () => {
  base.close();
  await base.delete();
});

const mensaje = (seq: number, chatId = 'c1'): ChatMessage => ({
  chatId,
  seq,
  senderId: 'u2',
  clientKey: `${chatId}-${seq}`,
  kind: 'text',
  body: `m${seq}`,
  at: '2026-10-19T15:00:00.000Z',
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

describe('sincronizar', () => {
  it('pide desde lo que tengo y guarda solo lo que falta', async () => {
    nuevaBase();
    await guardarChats(base, [chat('c1')]);
    await guardarPagina(base, 'c1', [mensaje(1), mensaje(2)]);
    let pedido: Cursors = {};

    const resultado = await sincronizar({
      base,
      pedir: async (cursores) => {
        pedido = cursores;
        return [{ chatId: 'c1', messages: [mensaje(3), mensaje(4)] }];
      },
    });

    expect(pedido).toEqual({ c1: 2 });
    expect(resultado).toEqual({ recibidos: 2 });
    expect((await mensajesDelChat(base, 'c1', 10)).map((m) => m.seq)).toEqual([1, 2, 3, 4]);
  });

  it('sin respuesta del server no toca nada y lo dice', async () => {
    nuevaBase();
    await guardarChats(base, [chat('c1')]);
    await guardarPagina(base, 'c1', [mensaje(1)]);

    const resultado = await sincronizar({ base, pedir: async () => null });

    expect(resultado).toBeNull();
    expect(await mensajesDelChat(base, 'c1', 10)).toHaveLength(1);
  });

  it('sin nada guardado no pide: el server mandaría el historial de todos los chats', async () => {
    nuevaBase();
    let llamado = false;

    const resultado = await sincronizar({
      base,
      pedir: async () => {
        llamado = true;
        return [];
      },
    });

    expect(llamado).toBe(false);
    expect(resultado).toEqual({ recibidos: 0 });
  });
});
