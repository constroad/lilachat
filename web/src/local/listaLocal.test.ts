import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { aplicarMensajeALista } from '@lilachat/shared';
import { BaseLocal } from './baseLocal';
import { cambiarFila } from './listaLocal';
import type { ChatSummary } from '../chat/types';

const YO = '665f1a2b3c4d5e6f70818293';
const fila: ChatSummary = { id: 'c1', kind: 'direct', memberIds: [YO, 'otro'], lastSeq: 3, unread: 0, lastMessage: null, othersReadSeq: 3, othersDeliveredSeq: 3 };
let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`lista-${(numero += 1)}`));
afterEach(async () => {
  base.close();
  await base.delete();
});

describe('cambiarFila', () => {
  it('un mensaje nuevo cambia su fila en la base, sin pedir la lista', async () => {
    nuevaBase();
    await base.chats.put(fila);
    const estaba = await cambiarFila(base, 'c1', (chats) => aplicarMensajeALista(chats, { chatId: 'c1', seq: 4, senderId: 'otro', body: 'hola', at: '2026-10-19T20:00:00.000Z' }, YO));
    expect(estaba).toBe(true);
    expect(await base.chats.get('c1')).toMatchObject({ lastSeq: 4, unread: 1, lastMessage: { body: 'hola' } });
  });

  it('un chat que no está avisa para pedir la lista', async () => {
    nuevaBase();
    expect(await cambiarFila(base, 'nuevo', (chats) => chats)).toBe(false);
  });
});
