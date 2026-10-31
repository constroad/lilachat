import { describe, expect, it } from 'vitest';
import { armarReporte, reportCode, esReporteValido, MAX_PENDING_REPORTS, pendingReportsFrom, queueReport, type CrashReport } from './crashReport.js';

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

/**
 * Which code crashed (31/10): the same APK runs any OTA of its runtime, so the
 * version alone could not tell whether a phone that kept closing had the fix.
 */
describe('the code a report ran', () => {
  const base = { app: 'lilachat', version: '0.1.175', plataforma: 'android', pantalla: 'app', error: new Error('boom'), enviadoEn: '2026-10-31T00:00:00.000Z' };

  it('carries the OTA update id, or «embedded» for the APK own code', () => {
    // Arrange / Act
    const withUpdate = armarReporte({ ...base, code: '3b7f15e9-0d1c-4a7e-9a55-12ab34cd56ef' });
    const embedded = armarReporte({ ...base, code: 'embedded' });
    // Assert
    expect(withUpdate.code).toBe('3b7f15e9-0d1c-4a7e-9a55-12ab34cd56ef');
    expect(embedded.code).toBe('embedded');
  });

  it('drops anything that is not an id: no spaces, no long text, nothing that could carry data', () => {
    // Arrange / Act / Assert
    expect(armarReporte({ ...base, code: 'hola José 902049935' }).code).toBeUndefined();
    expect(armarReporte({ ...base, code: 'a'.repeat(65) }).code).toBeUndefined();
    expect(armarReporte({ ...base, code: '' }).code).toBeUndefined();
    expect(armarReporte(base).code).toBeUndefined();
  });

  it('the server reads it from an untrusted body the same way', () => {
    // Arrange / Act / Assert
    expect(reportCode({ code: 'embedded' })).toBe('embedded');
    expect(reportCode({ code: '<script>' })).toBeUndefined();
    expect(reportCode({ code: 42 })).toBeUndefined();
    expect(reportCode(null)).toBeUndefined();
  });
});

/**
 * Reports that could not leave (31/10): a fatal error closes the app before the
 * request goes out, and without signal it never did. They wait on the phone
 * and go at the next start.
 */
describe('the reports waiting to leave', () => {
  const report = (mensaje: string, extra: Partial<CrashReport> = {}): CrashReport => ({ app: 'lilachat', version: '0.1.175', plataforma: 'android', pantalla: 'fatal', mensaje, stack: '', enviadoEn: '2026-10-31T00:00:00.000Z', ...extra });

  it('a new one waits last', () => {
    // Arrange / Act
    const queued = queueReport([report('uno')], report('dos'));
    // Assert
    expect(queued.map((one) => one.mensaje)).toEqual(['uno', 'dos']);
  });

  it('the same crash again does not take a second place: the newer one stays', () => {
    // Arrange / Act
    const queued = queueReport([report('boom', { enviadoEn: 'antes' }), report('otro')], report('boom', { enviadoEn: 'después' }));
    // Assert
    expect(queued.map((one) => [one.mensaje, one.enviadoEn])).toEqual([['otro', '2026-10-31T00:00:00.000Z'], ['boom', 'después']]);
  });

  it('the same message on another update is another crash', () => {
    // Arrange / Act
    const queued = queueReport([report('boom', { code: 'a1' })], report('boom', { code: 'b2' }));
    // Assert
    expect(queued).toHaveLength(2);
  });

  it('at most the newest ones fit: a phone that crashes in a loop does not fill its storage', () => {
    // Arrange
    let queued: CrashReport[] = [];
    // Act
    for (let index = 0; index < MAX_PENDING_REPORTS + 5; index += 1) queued = queueReport(queued, report(`error ${index}`));
    // Assert
    expect(queued).toHaveLength(MAX_PENDING_REPORTS);
    expect(queued.at(-1)?.mensaje).toBe(`error ${MAX_PENDING_REPORTS + 4}`);
  });

  it('what was stored is read back only when it is a report; anything else is dropped', () => {
    // Arrange / Act / Assert
    expect(pendingReportsFrom(JSON.stringify([report('uno'), { app: 'otra' }, 'basura']))).toEqual([report('uno')]);
    expect(pendingReportsFrom('no es json')).toEqual([]);
    expect(pendingReportsFrom(null)).toEqual([]);
  });
});
