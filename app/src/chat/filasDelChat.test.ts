import { describe, expect, it } from 'vitest';
import { citadosPorSeq, tipoDeFila, type FilaMinima } from './filasDelChat';

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

  it('si el citado no está cargado, no hay cita', () => {
    expect(citadosPorSeq([msj(5, { replyToSeq: 1 })], contexto, preview).size).toBe(0);
  });
});
