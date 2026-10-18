import { describe, expect, it } from 'vitest';
import { citadosPorSeq, fotosDelChat, tipoDeFila, type FilaMinima } from './filasDelChat';

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
    expect(tipoDeFila({ pending: true, clientKey: 'k' })).toBe('pendiente');
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

  it('si el citado es mío, el autor es «Vos»', () => {
    const mensajes = [msj(1, { senderId: 'yo', body: 'mío' }), msj(2, { replyToSeq: 1 })];

    expect(citadosPorSeq(mensajes, contexto, preview).get(2)?.autor).toBe('Vos');
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
