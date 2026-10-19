import { describe, expect, it } from 'vitest';
import { citadosPorSeq, claveDeFila, filaDeArchivoEnCola, fotosDelChat, sinPendientesConfirmados, tipoDeFila, type FilaMinima, anchoDeBurbujaConFoto, miniaturaDe } from './filasDelChat';

const msj = (seq: number, cambios: Partial<FilaMinima> = {}): FilaMinima => ({
  seq,
  senderId: 'otro',
  body: `m${seq}`,
  ...cambios,
});

const preview = (m: FilaMinima) => m.body ?? 'Mensaje';

/**
 * FL2: la conversación se dibujaba entera en cada tecla. Lo que la lista
 * necesita por fila (de qué tipo es, a quién cita) se calcula UNA vez por
 * cambio de mensajes, no por fila y por render.
 */
describe('tipoDeFila', () => {
  it('separa texto, media, aviso y pendiente: FlashList recicla por tipo', () => {
    expect(tipoDeFila(msj(1))).toBe('texto');
    expect(tipoDeFila(msj(2, { media: { mime: 'image/jpeg' } }))).toBe('media');
    expect(tipoDeFila(msj(3, { kind: 'system' }))).toBe('aviso');
    // FL12 (§49 #7): el pendiente recicla con el MISMO tipo que tendrá al
    // confirmarse. Con un tipo propio, FlashList cambiaba de celda justo cuando
    // aparecía el check.
    expect(tipoDeFila({ pending: true, clientKey: 'k' })).toBe('texto');
    expect(tipoDeFila({ pending: true, clientKey: 'k', mediaUri: 'file://foto.jpg' })).toBe('media');
  });

  it('un mensaje borrado es texto (la lápida), aunque tuviera media', () => {
    expect(tipoDeFila(msj(4, { deletedAt: '2026-10-16', media: { mime: 'image/jpeg' } }))).toBe('texto');
  });
});

describe('citadosPorSeq', () => {
  const contexto = { yo: 'yo', esGrupo: false, nombreDelOtro: 'Wilson' };

  it('arma la cita de cada respuesta con su autor y su texto', () => {
    const mensajes = [msj(1, { body: 'hola' }), msj(2, { replyToSeq: 1, senderId: 'yo' })];

    const citados = citadosPorSeq(mensajes, contexto, preview);

    expect(citados.get(2)).toEqual({ autor: 'Wilson', texto: 'hola' });
    expect(citados.has(1)).toBe(false);
  });

  it('si el citado es mío, el autor es «Tú»', () => {
    const mensajes = [msj(1, { senderId: 'yo', body: 'mío' }), msj(2, { replyToSeq: 1 })];

    expect(citadosPorSeq(mensajes, contexto, preview).get(2)?.autor).toBe('Tú');
  });

  /** En un grupo no se conoce acá el nombre de cada miembro: mejor nada que uno falso. */
  it('en un grupo, el autor ajeno queda vacío', () => {
    const mensajes = [msj(1), msj(2, { replyToSeq: 1 })];

    expect(citadosPorSeq(mensajes, { ...contexto, esGrupo: true }, preview).get(2)?.autor).toBe('');
  });

  // FL9 (auditoría §46.2): con los nombres del grupo a mano, la cita dice de quién es.
  it('en un grupo con los nombres conocidos, el autor es el de ese miembro', () => {
    const mensajes = [msj(1, { senderId: 'ana' }), msj(2, { replyToSeq: 1 })];
    const nombres = new Map([['ana', 'Ana']]);

    expect(citadosPorSeq(mensajes, { ...contexto, esGrupo: true, nombres }, preview).get(2)?.autor).toBe('Ana');
  });

  it('si el citado no está cargado, no hay cita', () => {
    expect(citadosPorSeq([msj(5, { replyToSeq: 1 })], contexto, preview).size).toBe(0);
  });
});

/**
 * Las fotos del visor (salió de `ChatScreen`): el archivo COMPLETO y no la
 * miniatura, el autor resuelto (en un grupo, quién la mandó), y ni los
 * eliminados ni lo que no tiene miniatura (eso se abre con otra app).
 */
describe('fotosDelChat', () => {
  const YO = '665f1a2b3c4d5e6f70818293';
  const ANA = '665f1a2b3c4d5e6f70818294';
  const at = '2026-10-17T15:04:00.000Z';
  const conFoto = (seq: number, senderId: string, extra: Record<string, unknown> = {}) => ({
    seq,
    senderId,
    at,
    media: { url: `https://x/${seq}.jpg`, thumbUrl: `https://x/t${seq}.jpg`, mime: 'image/jpeg', fileName: `${seq}.jpg` },
    ...extra,
  });

  it('el archivo completo, la miniatura aparte, y «Tú» en lo propio', () => {
    const [foto] = fotosDelChat([conFoto(1, YO)], { yo: YO, esGrupo: false, nombres: new Map(), nombreDelChat: 'Ana' });

    expect(foto).toMatchObject({ url: 'https://x/1.jpg', miniatura: 'https://x/t1.jpg', autor: 'Tú', mia: true, seq: 1 });
    expect(foto?.cuandoReal.toISOString()).toBe(at);
  });

  it('en un grupo, el nombre de quien la mandó; si no se sabe, el del chat', () => {
    const contexto = { yo: YO, esGrupo: true, nombres: new Map([[ANA, 'Ana']]), nombreDelChat: 'Familia' };

    const fotos = fotosDelChat([conFoto(1, ANA), conFoto(2, 'desconocido')], contexto);

    expect(fotos.map((foto) => foto.autor)).toEqual(['Ana', 'Familia']);
  });

  it('sin miniatura o eliminada, no va al visor', () => {
    const sinMiniatura = { seq: 3, senderId: ANA, at, media: { url: 'https://x/doc.zip', mime: 'application/zip' } };
    const eliminada = conFoto(4, ANA, { deletedAt: at });

    expect(fotosDelChat([sinMiniatura, eliminada], { yo: YO, esGrupo: false, nombres: new Map(), nombreDelChat: 'Ana' })).toEqual([]);
  });
});

/** Un archivo en cola como fila pendiente (salió de `ChatScreen`; FL9: con su forma). */
describe('filaDeArchivoEnCola', () => {
  it('lleva la foto, su pie, su forma y el progreso', () => {
    const archivo = {
      clientKey: '3f2b8c1e-6a4d-4e2f-9b7a-1c2d3e4f5a6b',
      chatId: '6a90cf9012ab34cd56ef7890',
      uri: 'file:///cola/foto.jpg',
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      caption: 'la roja',
      width: 4000,
      height: 3000,
      queuedAt: '2026-10-18T10:00:00.000Z',
      intentos: 0,
    };

    expect(filaDeArchivoEnCola(archivo, 0.5)).toEqual({
      clientKey: archivo.clientKey,
      queuedAt: archivo.queuedAt,
      pending: true,
      mediaUri: archivo.uri,
      mediaMime: 'image/jpeg',
      mediaNombre: 'foto.jpg',
      mediaAncho: 4000,
      mediaAlto: 3000,
      body: 'la roja',
      progreso: 0.5,
      fallo: undefined,
    });
  });
});

/**
 * Foto con pie (FL11, José 18/10: «se ve con un padding a la derecha»): el pie
 * largo estiraba la burbuja al 80 % y la foto quedaba pegada a la izquierda.
 * La burbuja no pasa del ancho de la foto; el pie se ajusta a ella.
 */
describe('anchoDeBurbujaConFoto', () => {
  it('vertical: el ancho de la foto (240 en el alto máximo)', () => {
    expect(anchoDeBurbujaConFoto({ width: 1080, height: 1920 })).toBeLessThanOrEqual(240);
  });

  it('apaisada: hasta 240', () => {
    expect(anchoDeBurbujaConFoto({ width: 1920, height: 1080 })).toBe(240);
  });

  it('sin dimensiones (fotos viejas): el cuadrado de siempre', () => {
    expect(anchoDeBurbujaConFoto({})).toBe(220);
  });
});

/**
 * Una foto sin miniatura (E2E de FL11, 18/10: el storage no siempre la genera)
 * no se dibujaba: la burbuja mostraba solo el pie. Una IMAGEN usa su archivo
 * completo; un video no, porque su URL es el video y no una imagen.
 */
describe('miniaturaDe', () => {
  it('con miniatura, la miniatura', () => {
    expect(miniaturaDe({ thumbUrl: 't.jpg', url: 'f.jpg', mime: 'image/jpeg' })).toBe('t.jpg');
  });

  it('imagen sin miniatura: el archivo completo', () => {
    expect(miniaturaDe({ url: 'f.png', mime: 'image/png' })).toBe('f.png');
  });

  it('video o archivo sin miniatura: nada', () => {
    expect(miniaturaDe({ url: 'v.mp4', mime: 'video/mp4' })).toBeUndefined();
    expect(miniaturaDe({ url: 'd.pdf', mime: 'application/pdf' })).toBeUndefined();
  });

  it('el visor también la incluye', () => {
    const fotos = fotosDelChat([{ seq: 1, senderId: 'a', at: '2026-10-18T10:00:00Z', media: { url: 'f.png', mime: 'image/png' } }], {
      yo: 'b', esGrupo: false, nombres: new Map(), nombreDelChat: 'QA Ana',
    });
    expect(fotos.map((foto) => foto.miniatura)).toEqual(['f.png']);
  });
});

/**
 * FL12 (§49 #7): al enviar, la burbuja pasa de pendiente a confirmada. Con la
 * MISMA clave es la misma celda y solo cambia el reloj por el check; con claves
 * distintas FlashList sacaba una celda y metía otra, y a veces se veían dos.
 */
describe('claveDeFila', () => {
  it('pendiente y confirmado del mismo envío comparten clave', () => {
    expect(claveDeFila({ pending: true, clientKey: 'abc' })).toBe(claveDeFila({ seq: 7, clientKey: 'abc' }));
  });

  it('sin clientKey (historial viejo) la clave sale del seq', () => {
    expect(claveDeFila({ seq: 7 })).toBe('m-7');
  });
});

describe('sinPendientesConfirmados', () => {
  it('saca el pendiente cuyo mensaje ya llegó confirmado', () => {
    const pendientes = [{ pending: true as const, clientKey: 'a' }, { pending: true as const, clientKey: 'b' }];
    const mensajes = [{ seq: 1, clientKey: 'x' }, { seq: 2, clientKey: 'a' }];
    expect(sinPendientesConfirmados(pendientes, mensajes).map((p) => p.clientKey)).toEqual(['b']);
  });

  it('sin coincidencias devuelve la MISMA lista', () => {
    const pendientes = [{ pending: true as const, clientKey: 'a' }];
    expect(sinPendientesConfirmados(pendientes, [{ seq: 1, clientKey: 'x' }])).toBe(pendientes);
  });
});
