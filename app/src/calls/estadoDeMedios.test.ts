import { describe, expect, it } from 'vitest';
import type { CallState } from '@lilachat/shared';
import { ESPERA_DE_CONEXION_MS, esperaAntesDeRendirse, estadoDeMedios, leyendaDeLlamada } from './estadoDeMedios';

/**
 * Contestada ≠ conectada (FL8; prueba real del 17/10/2026: el reloj corría
 * desde que José contestó y él no escuchaba nada — la pantalla no distinguía
 * «el otro aceptó» de «el audio está pasando»).
 */
describe('estadoDeMedios', () => {
  it('antes de conectar por primera vez, conectando', () => {
    expect(estadoDeMedios('new', false)).toBe('conectando');
    expect(estadoDeMedios('checking', false)).toBe('conectando');
  });

  it('connected y completed son audio pasando', () => {
    expect(estadoDeMedios('connected', false)).toBe('conectada');
    expect(estadoDeMedios('completed', true)).toBe('conectada');
  });

  it('se cortó después de haber conectado: reconectando', () => {
    expect(estadoDeMedios('disconnected', true)).toBe('reconectando');
    expect(estadoDeMedios('checking', true)).toBe('reconectando');
  });

  it('disconnected sin haber conectado nunca sigue siendo conectando', () => {
    expect(estadoDeMedios('disconnected', false)).toBe('conectando');
  });

  it('failed es fallo, haya conectado o no', () => {
    expect(estadoDeMedios('failed', false)).toBe('fallo');
    expect(estadoDeMedios('failed', true)).toBe('fallo');
  });

  it('closed no cambia nada: lo cierra quien cuelga', () => {
    expect(estadoDeMedios('closed', true)).toBe('conectada');
    expect(estadoDeMedios('closed', false)).toBe('conectando');
  });
});

describe('leyendaDeLlamada', () => {
  const desde = 1_000_000;
  const activa: CallState = { fase: 'activa', desde, entrante: false, conectadaEn: desde + 5_000 };

  it('activa pero sin audio todavía: «Conectando…», no el reloj', () => {
    expect(leyendaDeLlamada({ state: activa, medios: 'conectando', video: false, ahora: desde + 9_000 })).toBe('Conectando…');
  });

  it('activa con audio: el reloj', () => {
    expect(leyendaDeLlamada({ state: activa, medios: 'conectada', video: false, ahora: desde + 70_000 })).toBe('01:05');
  });

  it('se cortó el audio: «Reconectando…»', () => {
    expect(leyendaDeLlamada({ state: activa, medios: 'reconectando', video: false, ahora: desde + 9_000 })).toBe('Reconectando…');
  });

  it('llamando y sonando no dependen de los medios', () => {
    expect(leyendaDeLlamada({ state: { fase: 'llamando', desde, entrante: false }, medios: 'conectando', video: false, ahora: desde })).toBe('Llamando…');
    expect(leyendaDeLlamada({ state: { fase: 'sonando', desde, entrante: true }, medios: 'conectando', video: true, ahora: desde })).toBe('Videollamada entrante');
  });

  it('terminada por conexión perdida lo dice', () => {
    const caida: CallState = { fase: 'terminada', desde, entrante: false, conectadaEn: desde + 5_000, terminadaEn: desde + 40_000, motivo: 'desconectada', porMi: false };
    expect(leyendaDeLlamada({ state: caida, medios: 'fallo', video: false, ahora: desde + 41_000 })).toBe('No se pudo conectar');
  });

  it('terminada por otro motivo: «Llamada terminada»', () => {
    const colgada: CallState = { fase: 'terminada', desde, entrante: false, conectadaEn: null, terminadaEn: desde + 4_000, motivo: 'colgada', porMi: true };
    expect(leyendaDeLlamada({ state: colgada, medios: 'conectando', video: false, ahora: desde + 5_000 })).toBe('Llamada terminada');
  });
});

describe('esperaAntesDeRendirse', () => {
  // Sin candidatos del otro lado ICE no llega nunca a `failed`: en el E2E quedó
  // «Conectando…» 80 s, hasta que se colgó a mano.
  it('conectando o reconectando: hay un tope', () => {
    expect(esperaAntesDeRendirse('conectando')).toBe(ESPERA_DE_CONEXION_MS);
    expect(esperaAntesDeRendirse('reconectando')).toBe(ESPERA_DE_CONEXION_MS);
  });

  it('conectada o ya fallida: no hay nada que esperar', () => {
    expect(esperaAntesDeRendirse('conectada')).toBeNull();
    expect(esperaAntesDeRendirse('fallo')).toBeNull();
  });
});
