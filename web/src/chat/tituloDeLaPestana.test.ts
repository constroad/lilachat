import { describe, expect, it } from 'vitest';
import { chatsSinLeer, tituloDeLaPestana } from './tituloDeLaPestana';
import type { ChatSummary } from './types';

const chat = (extra: Partial<ChatSummary>): ChatSummary => ({
  id: 'c',
  kind: 'direct',
  memberIds: [],
  lastSeq: 0,
  unread: 0,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  ...extra,
});

describe('chatsSinLeer', () => {
  it('cuenta CHATS con algo sin leer, como WhatsApp Web, no mensajes', () => {
    expect(chatsSinLeer([chat({ unread: 5 }), chat({ unread: 1 }), chat({})])).toBe(2);
  });

  it('el marcado a mano como no leído cuenta', () => {
    expect(chatsSinLeer([chat({ markedUnread: true })])).toBe(1);
  });

  it('silenciados y archivados no cuentan: no deben llamar la atención', () => {
    expect(chatsSinLeer([chat({ unread: 3, muted: true }), chat({ unread: 2, archived: true })])).toBe(0);
  });
});

describe('tituloDeLaPestana', () => {
  it('con pendientes lleva el número adelante', () => {
    expect(tituloDeLaPestana(3)).toBe('(3) Lilachat');
  });

  it('sin pendientes, el nombre solo', () => {
    expect(tituloDeLaPestana(0)).toBe('Lilachat');
  });
});
