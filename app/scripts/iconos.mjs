#!/usr/bin/env node
/**
 * Los íconos de Lilachat, generados desde UN solo SVG.
 *
 * Existe porque hasta el 25/08/2026 la app se publicó con el ícono genérico de
 * la plantilla de Expo —la flecha azul— y así salió en el teléfono de José y en
 * la tienda. Un ícono dibujado a mano en cinco tamaños se desincroniza al primer
 * retoque; acá el dibujo está una vez y los cinco archivos se derivan.
 *
 *   node scripts/iconos.mjs
 *
 * Colores: SOLO los de `shared/src/tokens.ts` (Vivid Pulse). Ningún hex nuevo.
 *
 * Los tres archivos del ícono adaptativo de Android no son decoración: el
 * sistema recorta la capa de frente con la máscara del fabricante (círculo,
 * cuadrado redondeado, «squircle»…), así que **el dibujo vive dentro del 66 %
 * central** y el resto es aire. Llenar el lienzo entero es lo que produce íconos
 * con las puntas comidas.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// `sharp` es una dependencia nativa pesada y esto corre una vez cada muchos
// meses: se toma prestada la del workspace en vez de sumarla al APK.
const require = createRequire(import.meta.url);
const sharp = require('/Users/josezamora/projects/Portal/node_modules/sharp');

const AQUI = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(AQUI, '..', 'assets');

/** Vivid Pulse, copiados de `shared/src/tokens.ts`. */
const MARCA = {
  primary: '#6b38d4',
  brandPrimary: '#8b5cf6',
  brandSecondary: '#3b82f6',
  onPrimary: '#ffffff',
  fondoClaro: '#ede9fe',
};

/**
 * El glifo: una burbuja de chat con un latido adentro.
 *
 * La burbuja dice «conversación» sin texto y en cualquier idioma; el latido es
 * el «pulse» de la marca y lo que separa este ícono de los otros doscientos
 * íconos de chat. Se dibuja en una caja de 100×100 y después se escala.
 */
const glifo = (color) => `
  <path fill="${color}" d="
    M 50 16
    C 29.5 16 13 29.6 13 46.4
    C 13 55.9 18.3 64.3 26.6 69.8
    L 26.6 84
    C 26.6 85.8 28.6 86.8 30.1 85.8
    L 44.4 76.2
    C 46.2 76.4 48.1 76.5 50 76.5
    C 70.5 76.5 87 62.9 87 46.4
    C 87 29.6 70.5 16 50 16
    Z" />
  <path
    fill="none" stroke="${MARCA.primary}" stroke-width="6"
    stroke-linecap="round" stroke-linejoin="round"
    d="M 28 47 L 38 47 L 44 34 L 55 59 L 61 47 L 72 47" />
`;

/** El lienzo completo: fondo de marca + glifo. Para `icon.png` y el favicon. */
const completo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MARCA.brandPrimary}"/>
      <stop offset="1" stop-color="${MARCA.primary}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#fondo)"/>
  ${glifo(MARCA.onPrimary)}
</svg>`;

/**
 * La capa de FRENTE del ícono adaptativo: el glifo dentro del 66 % central,
 * sobre transparente. El `viewBox` ampliado es lo que produce ese margen sin
 * tener que redibujar nada.
 */
const frente = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -25 150 150">
  ${glifo(MARCA.onPrimary)}
</svg>`;

/** La capa de FONDO: color plano de marca, que es lo que recorta la máscara. */
const fondo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MARCA.brandPrimary}"/>
      <stop offset="1" stop-color="${MARCA.primary}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#g)"/>
</svg>`;

/**
 * La capa MONOCROMA (temas dinámicos de Android 13+): la silueta en blanco,
 * sin el latido en otro color — el sistema la recolorea entera y un trazo de
 * color se perdería.
 */
const monocromo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -25 150 150">
  <path fill="#ffffff" d="
    M 50 16 C 29.5 16 13 29.6 13 46.4 C 13 55.9 18.3 64.3 26.6 69.8
    L 26.6 84 C 26.6 85.8 28.6 86.8 30.1 85.8 L 44.4 76.2
    C 46.2 76.4 48.1 76.5 50 76.5 C 70.5 76.5 87 62.9 87 46.4
    C 87 29.6 70.5 16 50 16 Z" />
  <path fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round"
    stroke-linejoin="round"
    d="M 28 47 L 38 47 L 44 34 L 55 59 L 61 47 L 72 47" />
</svg>`;

/** La pantalla de arranque: el glifo solo, que Expo centra sobre su fondo. */
const splash = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -15 130 130">
  ${glifo(MARCA.primary)}
</svg>`;

const SALIDAS = [
  { archivo: 'icon.png', svg: completo, lado: 1024 },
  { archivo: 'android-icon-foreground.png', svg: frente, lado: 1024 },
  { archivo: 'android-icon-background.png', svg: fondo, lado: 1024 },
  { archivo: 'android-icon-monochrome.png', svg: monocromo, lado: 1024 },
  { archivo: 'splash-icon.png', svg: splash, lado: 512 },
  { archivo: 'favicon.png', svg: completo, lado: 96 },
];

mkdirSync(ASSETS, { recursive: true });

for (const salida of SALIDAS) {
  const png = await sharp(Buffer.from(salida.svg))
    .resize(salida.lado, salida.lado)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(ASSETS, salida.archivo), png);
  console.log(`✓ ${salida.archivo} · ${salida.lado}px · ${(png.length / 1024).toFixed(1)} KB`);
}

/** El de la tienda: 512 px, que es lo que sube `lila app icon`. */
const tienda = await sharp(Buffer.from(completo)).resize(512, 512).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(join(ASSETS, 'store-icon.png'), tienda);
console.log(`✓ store-icon.png · 512px · ${(tienda.length / 1024).toFixed(1)} KB`);
