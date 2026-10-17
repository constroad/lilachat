import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '../api/client';
import { aplicarMensajeALista, marcarLeido } from './listaEnVivo';

const YO = '665f1a2b3c4d5e6f70818293';
const OTRO = '665f1a2b3c4d5e6f70818294';
const CHAT = '6a90cf9012ab34cd56ef7890';

const chat = (cambios: Partial<ChatSummary> = {}): ChatSummary => ({
  id: CHAT,
  kind: 'direct',
  memberIds: [YO, OTRO],
  lastSeq: 4,
  unread: 0,
  lastMessage: { seq: 4, body: 'hola', kind: 'text', senderId: OTRO, at: '2026-10-16T10:00:00.000Z' },
  othersReadSeq: 4,
  othersDeliveredSeq: 4,
  ...cambios,
});

const mensaje = (cambios: Record<string, unknown> = {}) => ({
  chatId: CHAT,
  seq: 5,
  senderId: OTRO,
  kind: 'text',
  body: '¿vienes?',
  at: '2026-10-16T10:05:00.000Z',
  ...cambios,
});

/**
 * La lista se actualiza con el `msg.new` en vez de recargarse por HTTP. Antes
 * cada mensaje entrante era un GET /api/chats (3 viajes a la base + uno por
 * chat) para cambiar una sola fila.
 */
describe('aplicarMensajeALista', () => {
  it('un mensaje del otro mueve la vista previa y suma un no leído', () => {
    // Act
    const resultado = aplicarMensajeALista([chat()], mensaje(), YO);

    // Assert
    expect(resultado?.[0]).toMatchObject({
      lastSeq: 5,
      unread: 1,
      lastMessage: { seq: 5, body: '¿vienes?', senderId: OTRO, at: '2026-10-16T10:05:00.000Z' },
    });
  });

  it('lo mío mueve la vista previa pero NO suma no leídos', () => {
    const resultado = aplicarMensajeALista([chat()], mensaje({ senderId: YO }), YO);

    expect(resultado?.[0]?.unread).toBe(0);
    expect(resultado?.[0]?.lastMessage?.senderId).toBe(YO);
  });

  it('un duplicado (seq ya visto) deja la lista igual, misma referencia', () => {
    const lista = [chat()];

    const resultado = aplicarMensajeALista(lista, mensaje({ seq: 4 }), YO);

    expect(resultado).toBe(lista);
  });

  it('un chat que la lista no conoce devuelve null: hay que pedirla al server', () => {
    expect(aplicarMensajeALista([chat()], mensaje({ chatId: '6a917994aaaaaaaaaaaaaaaa' }), YO)).toBeNull();
  });

  it('un sobre cifrado no deja texto en la vista previa', () => {
    const resultado = aplicarMensajeALista(
      [chat({ encrypted: true })],
      mensaje({ body: undefined, envelope: { v: 1, nonce: 'n', ciphertext: 'c' } }),
      YO
    );

    expect(resultado?.[0]?.lastMessage?.body).toBeUndefined();
  });

  it('los otros chats conservan su referencia (la fila no se re-renderiza)', () => {
    const otro = chat({ id: '6a917994aaaaaaaaaaaaaaaa' });

    const resultado = aplicarMensajeALista([chat(), otro], mensaje(), YO);

    expect(resultado?.[1]).toBe(otro);
  });
});

/**
 * Con navegación nativa (FL1) la lista queda VIVA debajo del chat abierto: ya
 * no se remonta al volver, así que tiene que saber qué chat se está mirando.
 */
describe('la lista con un chat abierto encima', () => {
  it('un mensaje del chat abierto NO suma no leídos (se está leyendo)', () => {
    const resultado = aplicarMensajeALista([chat()], mensaje(), YO, CHAT);

    expect(resultado?.[0]).toMatchObject({ unread: 0, lastSeq: 5 });
  });

  it('un mensaje de OTRO chat sí suma, aunque haya uno abierto', () => {
    const resultado = aplicarMensajeALista([chat()], mensaje(), YO, '6a917994aaaaaaaaaaaaaaaa');

    expect(resultado?.[0]?.unread).toBe(1);
  });

  it('marcarLeido deja el chat en 0 y no toca a los demás', () => {
    const otro = chat({ id: '6a917994aaaaaaaaaaaaaaaa', unread: 2 });

    const resultado = marcarLeido([chat({ unread: 3 }), otro], CHAT);

    expect(resultado[0]?.unread).toBe(0);
    expect(resultado[1]).toBe(otro);
  });

  it('marcarLeido también quita la marca de «no leído» (FL9)', () => {
    const resultado = marcarLeido([chat({ unread: 0, markedUnread: true })], CHAT);

    expect(resultado[0]?.markedUnread).toBe(false);
  });

  it('marcarLeido sin nada que cambiar devuelve la misma lista', () => {
    const lista = [chat({ unread: 0 })];

    expect(marcarLeido(lista, CHAT)).toBe(lista);
  });
});
