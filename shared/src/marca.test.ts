import { describe, expect, it } from 'vitest';
import { LOGO, svgDelLogo } from './marca.js';
import { vividPulse } from './tokens.js';

/**
 * FL6: la marca en UNA geometría. El ícono de Android, el de la tienda y el
 * `<Logo>` de la app salen de acá; el viejo (óvalo estirado con un latido) se
 * dibujaba aparte en cada lugar.
 */
describe('LOGO', () => {
  it('sus colores salen de los tokens: ningún hex nuevo', () => {
    const permitidos = new Set([
      ...Object.values(vividPulse.colors.light),
      ...Object.values(vividPulse.colors.dark),
    ]);
    for (const tono of Object.values(LOGO.tonos)) {
      for (const color of [tono.fondo, tono.grande, tono.chica]) expect(permitidos).toContain(color);
    }
  });

  it('las dos burbujas son CÍRCULOS (radio igual en x e y): nada estirado', () => {
    for (const d of [LOGO.grande, LOGO.chica]) {
      const [, rx, ry] = d.match(/A(\d+) (\d+)/) ?? [];
      expect(rx).toBeDefined();
      expect(rx).toBe(ry);
    }
  });
});

describe('svgDelLogo', () => {
  it('dibuja las dos burbujas con el tono pedido', () => {
    const svg = svgDelLogo({ tamano: 64, tono: 'oscuro' });

    expect(svg).toContain(`width="64"`);
    expect(svg).toContain(LOGO.grande);
    expect(svg).toContain(LOGO.chica);
    expect(svg).toContain(`fill="${LOGO.tonos.oscuro.grande}"`);
  });

  it('sin fondo por defecto; con fondo, el del tono y esquinas redondeadas', () => {
    expect(svgDelLogo({ tamano: 64 })).not.toContain('rx=');
    expect(svgDelLogo({ tamano: 64, conFondo: true })).toContain(`fill="${LOGO.tonos.claro.fondo}"`);
  });

  it('el id de la máscara es configurable: dos logos en una página no se pisan', () => {
    const svg = svgDelLogo({ tamano: 32, id: 'otro' });

    expect(svg).toContain('id="otro"');
    expect(svg).toContain('url(#otro)');
  });

  it('margen: encoge el dibujo al centro (zona segura del adaptativo de Android)', () => {
    expect(svgDelLogo({ tamano: 64, escala: 0.66 })).toContain('scale(0.66)');
    expect(svgDelLogo({ tamano: 64 })).not.toContain('scale(');
  });
});
