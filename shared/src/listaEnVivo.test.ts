import { describe, expect, it } from 'vitest';
import { aplicarAcuseALista, aplicarBorradoALista, aplicarEdicionALista, aplicarMensajeALista, debeRecargarAlConectar, marcarLeido, puntoEnLinea, type ResumenEnVivo } from './listaEnVivo.js';

type ChatSummary = ResumenEnVivo & { name?: string; pinned?: boolean };

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

  /** Pending 53 (22/10): a GIF arriving live says «GIF» in the row, not «Foto». */
  it('a GIF that arrives carries its type to the row', () => {
    const rows = aplicarMensajeALista([chat()], { ...mensaje({ kind: 'image', body: undefined }), media: { mime: 'image/gif' } }, YO);
    expect(rows?.[0]?.lastMessage).toMatchObject({ kind: 'image', mime: 'image/gif' });
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

  // José, 22/10: Lila's bear played every time he opened her chat. The server had him at
  // seq 25; the row kept the readSeq of its last load, and the chat opens from the row.
  it('marcarLeido also moves my read cursor to the last message: reopening does not replay a wink', () => {
    // Arrange
    const chats = [chat({ lastSeq: 25, unread: 0, readSeq: 19 })];

    // Act
    const result = marcarLeido(chats, CHAT);

    // Assert
    expect(result[0]?.readSeq).toBe(25);
  });

  it('marcarLeido leaves out the cursor of a row that never had one (an older server)', () => {
    const result = marcarLeido([chat({ unread: 2 })], CHAT);

    expect(result[0]).not.toHaveProperty('readSeq');
  });

  it('marcarLeido with the cursor already at the end returns the same list', () => {
    const chats = [chat({ lastSeq: 25, unread: 0, readSeq: 25 })];

    expect(marcarLeido(chats, CHAT)).toBe(chats);
  });

  it('a message that arrives in the open chat is read there: the cursor follows it', () => {
    const result = aplicarMensajeALista([chat({ readSeq: 4 })], mensaje({ kind: 'guino', wink: 'panda' }), YO, CHAT);

    expect(result?.[0]).toMatchObject({ lastSeq: 5, unread: 0, readSeq: 5 });
  });

  it('a message in a closed chat leaves my cursor where it was', () => {
    const result = aplicarMensajeALista([chat({ readSeq: 4 })], mensaje(), YO);

    expect(result?.[0]).toMatchObject({ unread: 1, readSeq: 4 });
  });
});

/**
 * FL4: al conectar el socket la lista se recargaba aunque se acabara de cargar
 * (al montar). Se recarga si la última carga buena fue hace más de 3 s: una
 * reconexión de verdad (volver de segundo plano) siempre lo cumple.
 */
describe('debeRecargarAlConectar', () => {
  it('recién cargada: no', () => {
    expect(debeRecargarAlConectar({ ultimaCarga: 1000, ahora: 2500 })).toBe(false);
  });

  it('de hace rato, o nunca: sí', () => {
    expect(debeRecargarAlConectar({ ultimaCarga: 1000, ahora: 9000 })).toBe(true);
    expect(debeRecargarAlConectar({ ultimaCarga: null, ahora: 9000 })).toBe(true);
  });
});

/** El punto verde (FL10, auditoría §46.3): solo en un 1:1, como WhatsApp. */
describe('puntoEnLinea', () => {
  it('en un 1:1, si el otro está en línea', () => {
    expect(puntoEnLinea(chat(), YO, new Set([OTRO]))).toBe(true);
    expect(puntoEnLinea(chat(), YO, new Set([YO]))).toBe(false);
  });

  it('en un grupo nunca: con varios conectados sería ruido permanente', () => {
    expect(puntoEnLinea(chat({ kind: 'group', memberIds: [YO, OTRO] }), YO, new Set([OTRO]))).toBe(false);
  });
});

/**
 * José, 19/10: «mando un mensaje, veo 2 checks; salgo y la lista muestra uno;
 * vuelvo a entrar y queda uno». Solo el chat abierto escuchaba los acuses; la
 * lista guardaba los del server y el chat, al volver, partía de ahí.
 */
describe('aplicarAcuseALista', () => {
  const OTRA = '665f1a2b3c4d5e6f70818295';
  const mio = (cambios: Partial<ChatSummary> = {}) =>
    chat({ lastSeq: 7, othersReadSeq: 5, othersDeliveredSeq: 5, acuseDe: [OTRO], ...cambios });

  it('en un 1:1, el «me llegó» del otro sube el entregado de la fila', () => {
    // Arrange
    const chats = [mio()];

    // Act
    const nuevos = aplicarAcuseALista(chats, { chatId: CHAT, userId: OTRO, deliveredSeq: 7 }, YO, new Map());

    // Assert
    expect(nuevos[0]).toMatchObject({ othersDeliveredSeq: 7, othersReadSeq: 5 });
  });

  it('leer sube leído y entregado', () => {
    // Arrange
    const chats = [mio()];

    // Act
    const nuevos = aplicarAcuseALista(chats, { chatId: CHAT, userId: OTRO, readSeq: 7, deliveredSeq: 7 }, YO, new Map());

    // Assert
    expect(nuevos[0]).toMatchObject({ othersDeliveredSeq: 7, othersReadSeq: 7 });
  });

  it('a counter that only grew on the phone (the spaces badge, José 23/10) goes back to zero with my receipt', () => {
    // Arrange: the shell added 1 on msg.new without moving lastSeq
    const chats = [mio({ unread: 1, lastSeq: 7 })];

    // Act: I read it, here or on the web (seq 8)
    const updated = aplicarAcuseALista(chats, { chatId: CHAT, userId: YO, readSeq: 8 }, YO, new Map());

    // Assert
    expect(updated[0]?.unread).toBe(0);
  });

  it('mi propio acuse (otro dispositivo mío) no dice nada del otro, pero baja MIS no leídos', () => {
    // Arrange
    const chats = [mio({ unread: 3, markedUnread: true })];

    // Act
    const nuevos = aplicarAcuseALista(chats, { chatId: CHAT, userId: YO, readSeq: 6, deliveredSeq: 6 }, YO, new Map());

    // Assert
    expect(nuevos[0]).toMatchObject({ unread: 1, markedUnread: false, othersReadSeq: 5, othersDeliveredSeq: 5 });
  });

  it('my receipt from another device of mine also moves my read cursor', () => {
    const updated = aplicarAcuseALista([mio({ unread: 2, readSeq: 5 })], { chatId: CHAT, userId: YO, readSeq: 7 }, YO, new Map());

    expect(updated[0]).toMatchObject({ unread: 0, readSeq: 7 });
  });

  it('mi acuse que no baja nada devuelve la misma lista', () => {
    // Arrange
    const chats = [mio({ unread: 0 })];

    // Act
    const nuevos = aplicarAcuseALista(chats, { chatId: CHAT, userId: YO, readSeq: 7 }, YO, new Map());

    // Assert
    expect(nuevos).toBe(chats);
  });

  it('en un grupo, sube recién cuando le llegó a todos los que cuentan', () => {
    // Arrange
    const cursores = new Map();
    const chats = [mio({ kind: 'group', memberIds: [YO, OTRO, OTRA], acuseDe: [OTRO, OTRA] })];

    // Act
    const conUno = aplicarAcuseALista(chats, { chatId: CHAT, userId: OTRO, deliveredSeq: 7 }, YO, cursores);
    const conLosDos = aplicarAcuseALista(conUno, { chatId: CHAT, userId: OTRA, deliveredSeq: 7 }, YO, cursores);

    // Assert
    expect(conUno).toBe(chats);
    expect(conLosDos[0]?.othersDeliveredSeq).toBe(7);
  });

  it('un acuse que no mueve el check devuelve la misma lista (no redibuja)', () => {
    // Arrange
    const chats = [mio({ othersDeliveredSeq: 7 })];

    // Act
    const nuevos = aplicarAcuseALista(chats, { chatId: CHAT, userId: OTRO, deliveredSeq: 6 }, YO, new Map());

    // Assert
    expect(nuevos).toBe(chats);
  });

  it('un chat que la lista no tiene o un acuse sin forma no cambian nada', () => {
    // Arrange
    const chats = [mio()];

    // Act
    const otroChat = aplicarAcuseALista(chats, { chatId: 'otro', userId: OTRO, deliveredSeq: 9 }, YO, new Map());
    const roto = aplicarAcuseALista(chats, { chatId: CHAT }, YO, new Map());

    // Assert
    expect(otroChat).toBe(chats);
    expect(roto).toBe(chats);
  });

  it('sin `acuseDe` (server viejo) vale el mayor que llegó', () => {
    // Arrange
    const chats = [mio({ acuseDe: undefined })];

    // Act
    const nuevos = aplicarAcuseALista(chats, { chatId: CHAT, userId: OTRO, deliveredSeq: 7 }, YO, new Map());

    // Assert
    expect(nuevos[0]?.othersDeliveredSeq).toBe(7);
  });
});

/** Auditoría (19/10): la vista previa no se enteraba de ediciones ni de borrados. */
describe('ediciones y borrados en la vista previa', () => {
  it('editar el último cambia el texto de la fila', () => {
    const chats = [chat()];
    const nuevos = aplicarEdicionALista(chats, { chatId: CHAT, seq: 4, body: 'hola, corregido' });
    expect(nuevos[0]?.lastMessage?.body).toBe('hola, corregido');
  });

  it('editar uno que no es el último no toca nada', () => {
    const chats = [chat()];
    expect(aplicarEdicionALista(chats, { chatId: CHAT, seq: 3, body: 'x' })).toBe(chats);
  });

  it('borrar el último lo marca eliminado y le quita el texto', () => {
    const chats = [chat()];
    const nuevos = aplicarBorradoALista(chats, { chatId: CHAT, seq: 4 }, '2026-10-19T20:00:00.000Z');
    expect(nuevos[0]?.lastMessage).toMatchObject({ deletedAt: '2026-10-19T20:00:00.000Z', body: undefined });
  });

  it('un aviso sin forma o de otro chat no cambia nada', () => {
    const chats = [chat()];
    expect(aplicarBorradoALista(chats, { chatId: 'otro', seq: 4 }, 'x')).toBe(chats);
    expect(aplicarEdicionALista(chats, { chatId: CHAT })).toBe(chats);
  });
});

/** E3 (20/10): una respuesta de hilo llega en vivo a la fila con su marca. */
describe('respuesta de hilo en la fila', () => {
  it('el último mensaje lleva `hiloDe`', () => {
    const chats = [chat()];
    const nuevos = aplicarMensajeALista(chats, { chatId: CHAT, seq: 5, senderId: OTRO, body: 'en el hilo', at: '2026-10-20T10:00:00.000Z', hiloDe: 2 }, YO);
    expect(nuevos?.[0]?.lastMessage).toMatchObject({ body: 'en el hilo', hiloDe: 2 });
  });
});

