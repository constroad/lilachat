import { describe, expect, it } from 'vitest';
import type { CrashReport } from './crashReport.js';
import { debeAlertar, huellaDeReporte, textoDeAlerta, VENTANA_DEDUPE_MS } from './alerta.js';

const base: CrashReport = {
  app: 'lilachat',
  version: '0.1.18',
  plataforma: 'android',
  pantalla: 'app',
  mensaje: 'Rendered more hooks than during the previous render.',
  enviadoEn: '2026-08-27T14:00:00.000Z',
};

describe('debeAlertar', () => {
  it('el primero siempre se manda', () => {
    expect(debeAlertar({ reporte: base, ahora: 1_000, vistos: new Map() }).alertar).toBe(true);
  });

  /**
   * El caso que motiva todo esto: una pantalla en bucle dispara decenas de
   * reportes idénticos. El primero avisa; los siguientes ya no aportan nada y
   * lo único que consiguen es que se silencie el canal.
   */
  it('el mismo error de nuevo, enseguida, NO se manda', () => {
    const vistos = new Map([[huellaDeReporte(base), 1_000]]);

    expect(debeAlertar({ reporte: base, ahora: 2_000, vistos }).alertar).toBe(false);
  });

  it('el mismo error pasada la ventana vuelve a avisar', () => {
    const vistos = new Map([[huellaDeReporte(base), 1_000]]);

    expect(
      debeAlertar({ reporte: base, ahora: 1_000 + VENTANA_DEDUPE_MS, vistos }).alertar
    ).toBe(true);
  });

  it('otro error en la misma pantalla sí se manda', () => {
    const vistos = new Map([[huellaDeReporte(base), 1_000]]);
    const otro = { ...base, mensaje: 'Network request failed' };

    expect(debeAlertar({ reporte: otro, ahora: 1_100, vistos }).alertar).toBe(true);
  });

  /**
   * **El mismo error en una versión nueva es noticia otra vez.** Significa que
   * el arreglo que se publicó no funcionó, y esa es justo la que hay que ver.
   */
  it('el mismo error en una versión nueva vuelve a avisar', () => {
    const vistos = new Map([[huellaDeReporte(base), 1_000]]);
    const publicado = { ...base, version: '0.1.19' };

    expect(debeAlertar({ reporte: publicado, ahora: 1_100, vistos }).alertar).toBe(true);
  });

  /**
   * El stack NO forma parte de la huella: cambia entre builds y volvería único
   * a cada reporte, con lo que el dedupe dejaría de deduplicar.
   */
  it('un stack distinto no rompe el dedupe', () => {
    const vistos = new Map([[huellaDeReporte({ ...base, stack: 'at A' }), 1_000]]);

    expect(debeAlertar({ reporte: { ...base, stack: 'at B' }, ahora: 1_100, vistos }).alertar).toBe(
      false
    );
  });
});

describe('textoDeAlerta', () => {
  it('trae app, versión, pantalla y mensaje', () => {
    const texto = textoDeAlerta(base);

    expect(texto).toContain('lilachat');
    expect(texto).toContain('0.1.18');
    expect(texto).toContain('app');
    expect(texto).toContain('Rendered more hooks');
  });

  /** Sin versión no se escribe «lilachat  (android)» con un hueco. */
  it('sin versión lo dice, no deja un hueco', () => {
    expect(textoDeAlerta({ ...base, version: '' })).toContain('sin versión');
  });

  /** Telegram corta en 4096: un stack enorme se lleva puesto el mensaje. */
  it('recorta el stack largo y avisa que lo hizo', () => {
    const texto = textoDeAlerta({ ...base, stack: 'x'.repeat(5_000) });

    expect(texto.length).toBeLessThan(1_200);
    expect(texto).toContain('…');
    expect(texto).toContain('Rendered more hooks');
  });
});
