import { describe, expect, it } from 'vitest';
import { aplicarResumenDeHilo, hayRespuestasNuevas, canOpenThread, respuestasDelHilo, textoDelChipDeHilo, visibleEnElChat } from './hilos.js';

/** E3 (20/10): hilos. */
describe('visibleEnElChat', () => {
  it('una respuesta de hilo no sale en el chat, salvo «también enviar al chat»', () => {
    expect(visibleEnElChat({})).toBe(true);
    expect(visibleEnElChat({ hiloDe: 3 })).toBe(false);
    expect(visibleEnElChat({ hiloDe: 3, enElChat: true })).toBe(true);
  });
});

describe('textoDelChipDeHilo', () => {
  it('una o varias, con la hora de la última', () => {
    expect(textoDelChipDeHilo({ respuestas: 1, ultimaEn: '2026-10-20T16:05:00.000Z' })).toMatch(/^1 respuesta · /);
    expect(textoDelChipDeHilo({ respuestas: 4, ultimaEn: '2026-10-20T15:42:00.000Z' })).toMatch(/^4 respuestas · última /);
  });
  it('sin respuestas (todas borradas), nada', () => {
    expect(textoDelChipDeHilo({ respuestas: 0 })).toBe('');
  });
});

describe('hayRespuestasNuevas', () => {
  it('hay nuevas si la última es posterior a lo visto y no la escribí yo', () => {
    expect(hayRespuestasNuevas({ respuestas: 2, ultimaSeq: 9, autores: ['ana'] }, 7, 'yo')).toBe(true);
    expect(hayRespuestasNuevas({ respuestas: 2, ultimaSeq: 9, autores: ['ana'] }, 9, 'yo')).toBe(false);
    expect(hayRespuestasNuevas({ respuestas: 2, ultimaSeq: 9, autores: ['ana', 'yo'] }, 7, 'yo')).toBe(false);
    expect(hayRespuestasNuevas({ respuestas: 0, ultimaSeq: 9 }, 0, 'yo')).toBe(false);
  });
});

describe('respuestasDelHilo y aplicarResumenDeHilo', () => {
  const mensajes = [
    { seq: 1, body: 'raíz' },
    { seq: 3, hiloDe: 1, body: 'b' },
    { seq: 2, hiloDe: 1, body: 'a' },
    { seq: 4, body: 'otro' },
  ];
  it('las respuestas de una raíz, en orden', () => {
    expect(respuestasDelHilo(mensajes, 1).map((m) => m.body)).toEqual(['a', 'b']);
  });
  it('el resumen nuevo cae en su raíz; si la raíz no está, la misma lista', () => {
    const nuevos = aplicarResumenDeHilo(mensajes, 1, { respuestas: 2, ultimaSeq: 3 });
    expect(nuevos[0]).toMatchObject({ seq: 1, hilo: { respuestas: 2 } });
    expect(aplicarResumenDeHilo(mensajes, 99, { respuestas: 1 })).toBe(mensajes);
  });
});

/** José, 20/10: «al tocar un mensaje aparecen solo emojis; ahí también la manera de crear hilos», y en un recordatorio. */
describe('canOpenThread', () => {
  const vivo = { seq: 12, kind: 'text' };

  it('un mensaje o una tarjeta (recordatorio, evento, encuesta) confirmados abren hilo', () => {
    expect(canOpenThread(vivo)).toBe(true);
    expect(canOpenThread({ seq: 30, kind: 'text', ref: { tipo: 'recordatorio' } })).toBe(true);
  });

  it('no hay hilos de hilos, ni de avisos, ni de lo borrado', () => {
    expect(canOpenThread({ ...vivo, hiloDe: 4 })).toBe(false);
    expect(canOpenThread({ ...vivo, kind: 'system' })).toBe(false);
    expect(canOpenThread({ ...vivo, deletedAt: '2026-10-20T10:00:00Z' })).toBe(false);
  });

  it('the reminder that rang and the event coming up do open one (21/10)', () => {
    expect(canOpenThread({ ...vivo, kind: 'system', system: { evento: 'recordatorio-suena' } })).toBe(true);
    expect(canOpenThread({ ...vivo, kind: 'system', system: { evento: 'evento-pronto' } })).toBe(true);
  });

  it('ni en un chat secreto, ni de lo que todavía no llegó al server', () => {
    expect(canOpenThread({ ...vivo, cifrado: true })).toBe(false);
    expect(canOpenThread({ ...vivo, seq: null })).toBe(false);
  });
});
