import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BaseLocal } from './baseLocal';
import { ajustarChatLocal, quitarChatLocal } from './chatsLocales';
import type { ChatMessage, ChatSummary } from '../chat/types';

let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`chats-${(numero += 1)}`));

afterEach(async () => {
  base.close();
  await base.delete();
});

const chat = (id: string, extra: Partial<ChatSummary> = {}): ChatSummary => ({
  id,
  kind: 'direct',
  memberIds: ['yo', 'ana'],
  lastSeq: 2,
  unread: 2,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  ...extra,
});

const mensaje = (chatId: string, seq: number): ChatMessage => ({ chatId, seq, senderId: 'ana', clientKey: `${chatId}-${seq}`, kind: 'text', body: 'hola', at: '2026-10-19T10:00:00.000Z' });

describe('ajustarChatLocal', () => {
  it('cambia la fila y devuelve lo de antes para poder volver atrás', async () => {
    nuevaBase();
    await base.chats.put(chat('c1', { pinned: true }));
    const antes = await ajustarChatLocal(base, 'c1', { archived: true, pinned: false });
    expect(antes).toEqual({ archived: undefined, pinned: true });
    expect(await base.chats.get('c1')).toMatchObject({ archived: true, pinned: false });

    await ajustarChatLocal(base, 'c1', antes!);
    expect(await base.chats.get('c1')).toMatchObject({ pinned: true });
    expect((await base.chats.get('c1'))?.archived).toBeUndefined();
  });

  it('un chat que ya no está devuelve null y no crea nada', async () => {
    nuevaBase();
    expect(await ajustarChatLocal(base, 'no-existe', { muted: true })).toBeNull();
    expect(await base.chats.count()).toBe(0);
  });
});

describe('quitarChatLocal', () => {
  it('se lleva el chat, sus mensajes y lo pendiente; los otros chats quedan', async () => {
    nuevaBase();
    await base.chats.bulkPut([chat('c1'), chat('c2')]);
    await base.mensajes.bulkPut([mensaje('c1', 1), mensaje('c1', 2), mensaje('c2', 1)]);
    await base.cola.put({ clientKey: 'p1', chatId: 'c1', kind: 'text', body: 'pendiente', queuedAt: '2026-10-19T10:00:00.000Z', attempts: 0 });

    await quitarChatLocal(base, 'c1');

    expect(await base.chats.toCollection().primaryKeys()).toEqual(['c2']);
    expect(await base.mensajes.where('chatId').equals('c1').count()).toBe(0);
    expect(await base.mensajes.where('chatId').equals('c2').count()).toBe(1);
    expect(await base.cola.count()).toBe(0);
  });
});
