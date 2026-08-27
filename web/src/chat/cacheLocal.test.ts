import { beforeEach, describe, expect, it } from 'vitest';
import {
  guardarChats,
  guardarMensajes,
  leerChatsGuardados,
  leerMensajesGuardados,
  olvidarCache,
} from './cacheLocal';
import type { ChatMessage, ChatSummary } from './types';

/**
 * La caché de la web: pintar al instante en vez de esperar a la red.
 *
 * Lo que se cuida acá no es guardar —eso es fácil— sino **qué NO se guarda** y
 * qué pasa cuando lo guardado está roto.
 */
const chat = (id: string): ChatSummary => ({
  id,
  name: id,
  kind: 'direct',
  unread: 0,
  memberIds: [],
  lastSeq: 0,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
});

const mensaje = (seq: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  chatId: 'c1',
  seq,
  senderId: 'u2',
  kind: 'text',
  body: `mensaje ${seq}`,
  clientKey: `k${seq}`,
  createdAt: new Date().toISOString(),
  ...extra,
});

beforeEach(() => localStorage.clear());

describe('la lista de chats', () => {
  it('lo guardado se recupera', () => {
    guardarChats([chat('a')]);
    expect(leerChatsGuardados()).toEqual([chat('a')]);
  });

  it('sin nada guardado devuelve null, que es «todavía no sé»', () => {
    expect(leerChatsGuardados()).toBeNull();
  });

  /** Un `localStorage` con basura no puede impedir que la web abra. */
  it('basura guardada no rompe: devuelve null', () => {
    localStorage.setItem('lilachat.chats', 'esto no es json');
    expect(leerChatsGuardados()).toBeNull();
  });

  it('un JSON válido que no es una lista tampoco', () => {
    localStorage.setItem('lilachat.chats', '{"no":"soy una lista"}');
    expect(leerChatsGuardados()).toBeNull();
  });
});

describe('los mensajes', () => {
  it('se guardan y se leen por chat', () => {
    guardarMensajes('c1', [mensaje(1)]);
    expect(leerMensajesGuardados('c1')).toHaveLength(1);
    expect(leerMensajesGuardados('otro')).toBeNull();
  });

  /**
   * **LA regla de este archivo.** En un navegador no hay llavero: cualquier
   * clave viviría en `localStorage`, al lado de lo que protege. Así que un chat
   * cifrado NO se cachea — guardarlo en claro deshace justo lo que promete.
   */
  it('un mensaje cifrado NO se guarda', () => {
    guardarMensajes('secreto', [mensaje(1, { envelope: { v: 1, nonce: 'x', ciphertext: 'y' } })]);

    expect(leerMensajesGuardados('secreto')).toBeNull();
  });

  /** Basta UNO cifrado para no guardar la tanda: no se parte una conversación. */
  it('con uno cifrado entre varios, no se guarda ninguno', () => {
    guardarMensajes('mixto', [
      mensaje(1),
      mensaje(2, { envelope: { v: 1, nonce: 'x', ciphertext: 'y' } }),
    ]);

    expect(leerMensajesGuardados('mixto')).toBeNull();
  });

  it('se guardan los ÚLTIMOS, que son los que se leen al abrir', () => {
    guardarMensajes('c1', Array.from({ length: 90 }, (_, i) => mensaje(i)));
    const guardados = leerMensajesGuardados('c1');

    expect(guardados).toHaveLength(60);
    expect(guardados?.at(-1)?.seq).toBe(89);
  });
});

describe('olvidarCache', () => {
  it('borra chats y mensajes, y no toca lo demás', () => {
    guardarChats([chat('a')]);
    guardarMensajes('c1', [mensaje(1)]);
    localStorage.setItem('lilachat.credential', 'no me toques');

    olvidarCache();

    expect(leerChatsGuardados()).toBeNull();
    expect(leerMensajesGuardados('c1')).toBeNull();
    // La credencial la borra `clearCredential`, no esto: mezclarlos haría que
    // limpiar la caché cerrara la sesión sin que nadie lo pidiera.
    expect(localStorage.getItem('lilachat.credential')).toBe('no me toques');
  });
});
