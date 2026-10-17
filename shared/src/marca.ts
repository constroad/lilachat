import { vividPulse } from './tokens.js';

/**
 * La marca de Lilachat en UN solo lugar (FL6, spec §45). La misma geometría
 * dibuja el ícono de Android y de la tienda (`scripts/iconos-de-la-app.mts`) y el
 * `<Logo>` de la app (`app/src/ui/Logo.tsx`).
 *
 * Diseño 17/10/2026: dos burbujas REDONDAS que se superponen —una
 * conversación—, la grande con la cola abajo a la izquierda y la chica abajo a
 * la derecha, separadas por un corte del color del fondo. Reemplaza al óvalo
 * ancho con un latido adentro, que José veía «forzado, estirado» y que se leía
 * como app de salud. Misma familia que el molinete de Lilafotos: símbolo
 * plano, tonos lila, fondo blanco.
 */
const { light, dark } = vividPulse.colors;

export const LOGO = {
  viewBox: 1024,
  /** Radio 280, centro (448, 454). */
  grande: 'M399 730 Q296 740 206 748 Q226 680 206 594 A280 280 0 1 1 399 730 Z',
  /** Radio 190, centro (686, 654). */
  chica: 'M719 841 Q786 851 858 856 Q852 806 851 749 A190 190 0 1 0 719 841 Z',
  /** Grosor del corte entre las dos burbujas. */
  corte: 56,
  tonos: {
    claro: { fondo: light.surfaceContainerLowest, grande: light.primary, chica: dark.primary },
    oscuro: { fondo: dark.background, grande: dark.brandPrimary, chica: light.surfaceContainerLowest },
    /** Blanco sobre lila: la base de la que Android tiñe los íconos temáticos. */
    mono: { fondo: light.brandPrimary, grande: light.surfaceContainerLowest, chica: light.surfaceContainerLowest },
  },
} as const;

export type TonoDeLogo = keyof typeof LOGO.tonos;

/** Radio de las esquinas del fondo, como el de los íconos de la familia. */
const RADIO_DE_FONDO = 224;

/**
 * El logo como SVG suelto, para quien no tenga React (el script de íconos).
 * `escala` < 1 encoge el dibujo hacia el centro: el frente del ícono
 * adaptativo tiene que vivir en el 66 % que la máscara del fabricante no come.
 */
export function svgDelLogo(opciones: {
  tamano: number;
  tono?: TonoDeLogo;
  id?: string;
  conFondo?: boolean;
  escala?: number;
}): string {
  const { tamano, tono = 'claro', id = 'corte', conFondo = false, escala } = opciones;
  const colores = LOGO.tonos[tono];
  const lado = LOGO.viewBox;
  const mascara =
    `<mask id="${id}"><rect width="${lado}" height="${lado}" fill="#fff"/>` +
    `<path d="${LOGO.chica}" fill="#000" stroke="#000" stroke-width="${LOGO.corte}" stroke-linejoin="round"/></mask>`;
  const burbujas =
    `<path d="${LOGO.grande}" fill="${colores.grande}" mask="url(#${id})"/>` + `<path d="${LOGO.chica}" fill="${colores.chica}"/>`;
  const dibujo = escala ? `<g transform="translate(${lado / 2} ${lado / 2}) scale(${escala}) translate(${-lado / 2} ${-lado / 2})">${burbujas}</g>` : burbujas;
  const fondo = conFondo ? `<rect width="${lado}" height="${lado}" rx="${RADIO_DE_FONDO}" fill="${colores.fondo}"/>` : '';
  return (
    `<svg width="${tamano}" height="${tamano}" viewBox="0 0 ${lado} ${lado}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>${mascara}</defs>${fondo}${dibujo}</svg>`
  );
}
