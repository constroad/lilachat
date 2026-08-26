import { describe, expect, it } from 'vitest';
import { armarReporte, esReporteValido } from './crashReport.js';

/**
 * Los errores de las apps RN, para que dejen de ser invisibles.
 *
 * Reportado por José el 26/08/2026: tocó «Invitar» y no pasó nada. En Torre no
 * había ni una línea, en el server tampoco. Un botón que no hace nada y un
 * sistema que no se entera son el mismo problema visto desde dos lados: **si
 * falla en el teléfono de alguien, hoy no nos enteramos nunca**.
 *
 * El motor arma y valida el reporte. Lo que se cuida acá es qué NO se manda:
 * un reporte de error es la vía más fácil para que datos privados terminen en
 * un log — un mensaje del chat dentro de un stack trace, un teléfono, un token.
 */
describe('armarReporte', () => {
  const base = {
    app: 'lilachat',
    version: '0.1.5',
    plataforma: 'android',
    pantalla: 'InviteScreen',
  };

  it('lleva lo mínimo para poder buscar el bug', () => {
    const reporte = armarReporte({ ...base, error: new Error('boom'), enviadoEn: '2026-08-26T12:00:00.000Z' });

    expect(reporte.app).toBe('lilachat');
    expect(reporte.version).toBe('0.1.5');
    expect(reporte.pantalla).toBe('InviteScreen');
    expect(reporte.mensaje).toBe('boom');
  });

  /**
   * **El stack se recorta.** Uno completo de Hermes son cientos de líneas de
   * `node_modules`, y lo único que sirve son las primeras.
   */
  it('el stack va recortado', () => {
    const error = new Error('boom');
    error.stack = Array.from({ length: 200 }, (_, i) => `  en linea ${i}`).join('\n');

    const reporte = armarReporte({ ...base, error, enviadoEn: '2026-08-26T12:00:00.000Z' });

    expect(reporte.stack.split('\n').length).toBeLessThanOrEqual(20);
  });

  /** Algo que no es `Error` —un `throw 'texto'`, un rechazo con objeto— igual se reporta. */
  it('lo que se lanzó sin ser un Error también se reporta', () => {
    const reporte = armarReporte({ ...base, error: 'se rompió', enviadoEn: '2026-08-26T12:00:00.000Z' });

    expect(reporte.mensaje).toBe('se rompió');
    expect(reporte.stack).toBe('');
  });

  /**
   * **Nada del contenido del usuario.** Si el mensaje de error arrastra texto
   * de un chat o un teléfono, se recorta igual: el tope es duro y no depende de
   * que quien lanzó el error se haya portado bien.
   */
  it('el mensaje tiene tope duro', () => {
    const reporte = armarReporte({
      ...base,
      error: new Error('x'.repeat(5_000)),
      enviadoEn: '2026-08-26T12:00:00.000Z',
    });

    expect(reporte.mensaje.length).toBeLessThanOrEqual(500);
  });
});

describe('esReporteValido', () => {
  const valido = {
    app: 'lilachat',
    version: '0.1.5',
    plataforma: 'android',
    pantalla: 'InviteScreen',
    mensaje: 'boom',
    stack: '',
    enviadoEn: '2026-08-26T12:00:00.000Z',
  };

  it('acepta uno bien formado', () => {
    expect(esReporteValido(valido)).toBe(true);
  });

  /** Sin mensaje no hay nada que investigar: es ruido en el log. */
  it('rechaza uno sin mensaje', () => {
    expect(esReporteValido({ ...valido, mensaje: '' })).toBe(false);
  });

  it('rechaza cualquier cosa', () => {
    expect(esReporteValido(null)).toBe(false);
    expect(esReporteValido('boom')).toBe(false);
    expect(esReporteValido({})).toBe(false);
  });

  /**
   * El endpoint NO está autenticado —una app que crashea al arrancar no tiene
   * sesión que presentar—, así que el `app` se compara contra una lista: sin
   * eso, cualquiera puede llenar el log con lo que quiera y con el nombre que
   * quiera.
   */
  it('rechaza una app que no conocemos', () => {
    expect(esReporteValido({ ...valido, app: 'la-que-sea' })).toBe(false);
  });
});
