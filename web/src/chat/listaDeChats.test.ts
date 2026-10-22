import { describe, expect, it } from 'vitest';
import { buildChatList, ordenarParaLaLista } from './listaDeChats';
import type { ChatSummary } from './types';

const chat = (id: string, at: string | null, extra: Partial<ChatSummary> = {}): ChatSummary => ({
  id,
  kind: 'direct',
  memberIds: [],
  lastSeq: 0,
  unread: 0,
  lastMessage: at ? { seq: 1, senderId: 'u', at } : null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  ...extra,
});

describe('ordenarParaLaLista', () => {
  it('los fijados arriba y el resto por el último mensaje, como WhatsApp', () => {
    const orden = ordenarParaLaLista([
      chat('viejo', '2026-10-18T10:00:00.000Z'),
      chat('nuevo', '2026-10-19T10:00:00.000Z'),
      chat('fijado', '2026-10-01T10:00:00.000Z', { pinned: true }),
      chat('vacio', null),
    ]);

    expect(orden.map((c) => c.id)).toEqual(['fijado', 'nuevo', 'viejo', 'vacio']);
  });

  it('los archivados no van en la lista principal', () => {
    expect(ordenarParaLaLista([chat('a', null, { archived: true }), chat('b', null)]).map((c) => c.id)).toEqual(['b']);
  });
});

describe('buildChatList (W3)', () => {
  const base = (id: string, extra: Partial<ChatSummary> = {}): ChatSummary => ({
    id,
    kind: 'direct',
    name: id,
    memberIds: ['yo', id],
    lastSeq: 1,
    unread: 0,
    lastMessage: { seq: 1, body: `hola desde ${id}`, senderId: id, at: '2026-10-19T10:00:00.000Z' },
    othersReadSeq: 1,
    othersDeliveredSeq: 1,
    ...extra,
  });
  const chats = [
    base('Ana', { unread: 2 }),
    base('Familia', { kind: 'group', pinned: true }),
    base('Ideas', { kind: 'notas' }),
    base('Viejo', { archived: true, unread: 1 }),
    base('José', { markedUnread: true }),
  ];

  it('la principal: sin archivados, fijados arriba, y las cuentas de cada chip', () => {
    const listed = buildChatList({ chats, filtro: 'todos', texto: '', verArchivados: false });
    expect(listed.visibles.map((chat) => chat.id)[0]).toBe('Familia');
    expect(listed.visibles.map((chat) => chat.id)).not.toContain('Viejo');
    expect(listed.cuentas).toEqual({ 'no-leidos': 2, grupos: 1, borradores: 1 });
    expect(listed.archivados).toEqual({ total: 1, sinLeer: 1 });
  });

  it('los chips filtran y la búsqueda ignora tildes y mira el último mensaje', () => {
    expect(buildChatList({ chats, filtro: 'no-leidos', texto: '', verArchivados: false }).visibles.map((chat) => chat.id)).toEqual(['Ana', 'José']);
    expect(buildChatList({ chats, filtro: 'borradores', texto: '', verArchivados: false }).visibles.map((chat) => chat.id)).toEqual(['Ideas']);
    expect(buildChatList({ chats, filtro: 'todos', texto: 'jose', verArchivados: false }).visibles.map((chat) => chat.id)).toEqual(['José']);
    expect(buildChatList({ chats, filtro: 'todos', texto: 'desde ana', verArchivados: false }).visibles.map((chat) => chat.id)).toEqual(['Ana']);
  });

  it('«Archivados» muestra solo esos, sin chips', () => {
    const listed = buildChatList({ chats, filtro: 'grupos', texto: '', verArchivados: true });
    expect(listed.visibles.map((chat) => chat.id)).toEqual(['Viejo']);
  });
});

describe('buildChatList with a list of my own (pending 45)', () => {
  it('a list chip shows only the chats of that list, in the usual order', () => {
    // Arrange
    const chats = [chat('a', '2026-10-18T10:00:00.000Z'), chat('b', '2026-10-19T10:00:00.000Z'), chat('c', '2026-10-20T10:00:00.000Z')];
    // Act
    const built = buildChatList({ chats, filtro: 'lista:family', texto: '', verArchivados: false, lista: new Set(['a', 'c']) });
    // Assert
    expect(built.visibles.map((one) => one.id)).toEqual(['c', 'a']);
  });
});
