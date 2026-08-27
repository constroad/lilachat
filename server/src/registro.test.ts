import { describe, expect, it } from 'vitest';
import { lineaDeRegistro } from './registro.js';

/**
 * La hora en el log.
 *
 * Nace de un reclamo de José el 27/08/2026: abrió Torre y encontró una pared de
 * `[lilachat] escuchando en :3004` repetido, **sin una sola marca de tiempo**.
 * Sin hora un log no sirve para nada: no se puede saber si esos reinicios fueron
 * de hoy o de la semana pasada, ni si son un bucle o dos deploys.
 */
describe('lineaDeRegistro', () => {
  const en = new Date('2026-08-27T14:03:16.000Z');

  it('antepone la fecha y la hora al mensaje', () => {
    expect(lineaDeRegistro({ nivel: 'info', mensaje: 'escuchando en :3004', en })).toBe(
      '2026-08-27 09:03:16 INFO  escuchando en :3004'
    );
  });

  it('distingue el nivel, para poder grepear los errores', () => {
    expect(lineaDeRegistro({ nivel: 'error', mensaje: 'mongo caído', en })).toContain('ERROR');
  });

  /**
   * **La hora es la de Lima, siempre, y no la del sistema.**
   *
   * Es la lección de `server-timezone-changed-with-hosting`: la app ya se mudó
   * de host una vez y la zona cambió con ella. Un log fechado en la zona del
   * server obliga a saber dónde corre el server para leerlo, y esa respuesta
   * cambia sin avisar. Acá es Lima porque es la hora en la que José piensa.
   */
  it('fecha en Lima aunque el proceso corra en UTC', () => {
    const medianocheUtc = new Date('2026-08-27T02:00:00.000Z');

    // 02:00 UTC del 27 son las 21:00 del 26 en Lima: cambia la hora Y el día.
    expect(lineaDeRegistro({ nivel: 'info', mensaje: 'x', en: medianocheUtc })).toContain(
      '2026-08-26 21:00:00'
    );
  });

  /**
   * Un mensaje de varias líneas (un stack) mantiene su forma: solo la primera
   * lleva la marca. Prefijar cada línea rompe el stack para quien lo copia.
   */
  it('el stack se conserva tal cual debajo', () => {
    const linea = lineaDeRegistro({ nivel: 'error', mensaje: 'falló\n  at foo\n  at bar', en });

    expect(linea.split('\n')).toEqual([
      '2026-08-27 09:03:16 ERROR falló',
      '  at foo',
      '  at bar',
    ]);
  });
});
