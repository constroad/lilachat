import { describe, expect, it } from 'vitest';
import { ordenarParaLaLista } from './listaDeChats';
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
