/**
 * Los íconos de Lilachat, generados desde la geometría de `shared/src/marca.ts`
 * —la misma que dibuja `<Logo>` en la app—. Los PNG no se editan a mano.
 *
 *   npx tsx scripts/iconos-de-la-app.mts
 *
 * Existe porque hasta el 25/08/2026 la app salió con el ícono de la plantilla
 * de Expo, y porque un ícono dibujado aparte en cada tamaño se desincroniza al
 * primer retoque. Desde FL6 (17/10/2026) el dibujo vive en `shared` y acá solo
 * se exporta.
 *
 * El ícono adaptativo de Android recorta la capa de frente con la máscara del
 * fabricante (círculo, squircle…): **el dibujo va dentro del 66 % central**.
 * Llenar el lienzo es lo que produce íconos con las puntas comidas.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO, svgDelLogo } from '../shared/src/marca.ts';

// `sharp` es nativa y pesada, y esto corre una vez cada muchos meses: se toma
// prestada la del workspace de Portal en vez de sumarla a la app.
const require = createRequire(import.meta.url);
const sharp = require('/Users/josezamora/projects/Portal/node_modules/sharp') as typeof import('sharp');

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'assets');
const ZONA_SEGURA = 0.66;
const LIENZO = 1024;

const fondoPlano = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIENZO} ${LIENZO}"><rect width="${LIENZO}" height="${LIENZO}" fill="${LOGO.tonos.claro.fondo}"/></svg>`;

const SALIDAS = [
  { archivo: 'icon.png', svg: svgDelLogo({ tamano: LIENZO, conFondo: true }), lado: 1024 },
  { archivo: 'android-icon-foreground.png', svg: svgDelLogo({ tamano: LIENZO, escala: ZONA_SEGURA }), lado: 1024 },
  { archivo: 'android-icon-background.png', svg: fondoPlano, lado: 1024 },
  // Android 13+ tiñe la silueta entera: va blanca, con el corte entre burbujas.
  { archivo: 'android-icon-monochrome.png', svg: svgDelLogo({ tamano: LIENZO, tono: 'mono', escala: ZONA_SEGURA }), lado: 1024 },
  { archivo: 'splash-icon.png', svg: svgDelLogo({ tamano: LIENZO, escala: 0.8 }), lado: 512 },
  { archivo: 'favicon.png', svg: svgDelLogo({ tamano: LIENZO, conFondo: true }), lado: 96 },
  // El de la tienda: 512 px, que es lo que sube `lila app icon`.
  { archivo: 'store-icon.png', svg: svgDelLogo({ tamano: LIENZO, conFondo: true }), lado: 512 },
];

mkdirSync(ASSETS, { recursive: true });
for (const salida of SALIDAS) {
  const png = await sharp(Buffer.from(salida.svg)).resize(salida.lado, salida.lado).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(ASSETS, salida.archivo), png);
  console.log(`✓ ${salida.archivo} · ${salida.lado}px · ${(png.length / 1024).toFixed(1)} KB`);
}

/**
 * El ícono chico de las notificaciones (FL13, auditoría §48). Android lo pinta
 * por su silueta: con el ícono de la app de color salía un círculo gris sin
 * forma. Va blanco sobre transparente, 24 dp, en cada densidad;
 * el módulo nativo lo busca por nombre (`AvisoDeLlamada.iconoChico`).
 */
const RES_DEL_AVISO = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'modules', 'llamada-entrante', 'android', 'src', 'main', 'res');
const DENSIDADES = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 } as const;
/** El logo ocupa ~70 % de su lienzo: ×1.15 lo lleva a ~19 dp de los 24. */
const ESCALA_DEL_AVISO = 1.15;
for (const [densidad, lado] of Object.entries(DENSIDADES)) {
  const carpeta = join(RES_DEL_AVISO, `drawable-${densidad}`);
  mkdirSync(carpeta, { recursive: true });
  const svg = svgDelLogo({ tamano: LIENZO, tono: 'mono', escala: ESCALA_DEL_AVISO });
  const png = await sharp(Buffer.from(svg)).resize(lado, lado).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(carpeta, 'notification_icon.png'), png);
  console.log(`✓ notification_icon · ${densidad} · ${lado}px`);
}
