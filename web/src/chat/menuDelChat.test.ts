import { describe, expect, it } from 'vitest';
import { cambiosDeAjustes, levelChanges, opcionesDelMenuDeChat } from './menuDelChat';
import type { ChatSummary } from './types';

const chat = (extra: Partial<ChatSummary> = {}): ChatSummary => ({
  id: '6650f1c2a3b4c5d6e7f80911',
  kind: 'direct',
  name: 'Ana Torres',
  memberIds: ['yo', 'ana'],
  lastSeq: 12,
  unread: 0,
  lastMessage: null,
  othersReadSeq: 12,
  othersDeliveredSeq: 12,
  ...extra,
});

const acciones = (unChat: ChatSummary) => opcionesDelMenuDeChat(unChat).map((opcion) => opcion.accion);

describe('opcionesDelMenuDeChat', () => {
  it('un 1:1 al día: archivar, silenciar, fijar, no leído y eliminar (en rojo, al final)', () => {
    const opciones = opcionesDelMenuDeChat(chat());
    expect(opciones.map((opcion) => opcion.accion)).toEqual(['archivar', 'silenciar', 'fijar', 'no-leido', 'eliminar']);
    expect(opciones.at(-1)).toMatchObject({ etiqueta: 'Eliminar chat', peligro: true });
  });

  it('cada opción dice lo contrario cuando ya está hecho', () => {
    expect(acciones(chat({ archived: true, muted: true, unread: 3 }))).toEqual(['desarchivar', 'reactivar', 'leido', 'eliminar']);
    expect(acciones(chat({ pinned: true, markedUnread: true }))).toEqual(['archivar', 'silenciar', 'desfijar', 'leido', 'eliminar']);
  });

  it('un grupo se deja, no se elimina', () => {
    expect(acciones(chat({ kind: 'group' }))).toEqual(['archivar', 'silenciar', 'fijar', 'no-leido', 'salir']);
  });

  it('un borrador no suena: no tiene «silenciar»', () => {
    expect(acciones(chat({ kind: 'notas' }))).toEqual(['archivar', 'fijar', 'no-leido', 'eliminar']);
  });
});

describe('cambiosDeAjustes', () => {
  it('traduce cada acción a lo que espera PATCH /ajustes', () => {
    expect(cambiosDeAjustes('archivar')).toEqual({ archived: true, pinned: false });
    expect(cambiosDeAjustes('desarchivar')).toEqual({ archived: false });
    expect(cambiosDeAjustes('silenciar')).toEqual({ muted: true });
    expect(cambiosDeAjustes('reactivar')).toEqual({ muted: false });
    expect(cambiosDeAjustes('fijar')).toEqual({ pinned: true });
    expect(cambiosDeAjustes('desfijar')).toEqual({ pinned: false });
    expect(cambiosDeAjustes('no-leido')).toEqual({ markedUnread: true });
    expect(cambiosDeAjustes('leido')).toEqual({ markedUnread: false });
  });

  it('salir y eliminar no son ajustes', () => {
    expect(cambiosDeAjustes('salir')).toBeNull();
    expect(cambiosDeAjustes('eliminar')).toBeNull();
  });
});

/** E3b (20/10): a level goes as `avisos` and as `muted`, so the list stays in step. */
describe('notification level changes', () => {
  it('each level sends avisos and muted', () => {
    expect(levelChanges('todo')).toEqual({ avisos: 'todo', muted: false });
    expect(levelChanges('menciones')).toEqual({ avisos: 'menciones', muted: true });
    expect(levelChanges('nada')).toEqual({ avisos: 'nada', muted: true });
  });
});
