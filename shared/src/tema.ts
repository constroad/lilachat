import { vividPulse } from './tokens.js';

/**
 * El puente entre los tokens y las clases de Tailwind, para los DOS modos.
 *
 * Lilachat no tenía modo oscuro (reclamo de José, 27/08/2026). El camino obvio
 * —poner `dark:` en cada clase de cada pantalla— es el equivocado: son 20
 * pantallas, se olvida una y queda un bloque blanco en medio de una pantalla
 * negra, y desde ese momento cada clase nueva hay que acordarse de duplicarla.
 *
 * Acá los colores se declaran como VARIABLES CSS y las clases (`bg-surface`,
 * `text-on-surface`) quedan iguales en los dos modos: lo que cambia es el valor
 * de la variable. Una pantalla escrita sin pensar en el tema funciona en oscuro
 * sola.
 *
 * Este mapa es la fuente ÚNICA: de él salen el `tailwind.config.js` y el bloque
 * de variables de `global.css`. Que los dos se generen del mismo lugar es lo que
 * impide el fallo clásico —una variable que el Tailwind nombra y el CSS no
 * define, o al revés—, que se manifiesta como un color transparente y manda a
 * buscar el problema a cualquier otro lado.
 */
export const NOMBRES_DE_COLOR = {
  primary: 'primary',
  'primary-container': 'primaryContainer',
  'primary-brand': 'brandPrimary',
  secondary: 'secondary',
  'secondary-brand': 'brandSecondary',
  tertiary: 'tertiary',
  'tertiary-brand': 'brandTertiary',
  neutral: 'neutral',
  background: 'background',
  surface: 'surfaceContainerLowest',
  'surface-variant': 'surfaceVariant',
  'on-surface': 'onSurface',
  'on-surface-variant': 'onSurfaceVariant',
  outline: 'outline',
  error: 'error',
  'on-primary': 'onPrimary',
} as const;

export type NombreDeColor = keyof typeof NOMBRES_DE_COLOR;
export type Esquema = 'light' | 'dark';

/**
 * `#6b38d4` → `107 56 212`.
 *
 * Los canales van sueltos y sin `rgb()` porque Tailwind los envuelve él mismo
 * (`rgb(var(--color-x) / <alpha-value>)`). Es lo que hace que `bg-primary/10`
 * siga funcionando: con un `#hex` dentro de la variable, la opacidad se pierde y
 * todos los fondos tenues se vuelven sólidos.
 */
export function hexARgb(hex: string): string {
  const limpio = hex.replace('#', '');
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;

  if (!/^[0-9a-fA-F]{6}$/.test(completo)) {
    throw new Error(`Color inválido: ${hex}`);
  }

  const n = parseInt(completo, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Los hex de un modo, por nombre de clase de Tailwind. */
export function paletaDe(esquema: Esquema): Record<NombreDeColor, string> {
  const fuente: Record<string, string> = {
    ...vividPulse.colors.light,
    ...(esquema === 'dark' ? vividPulse.colors.dark : {}),
  };

  const salida = {} as Record<NombreDeColor, string>;
  for (const [clase, token] of Object.entries(NOMBRES_DE_COLOR)) {
    const hex = fuente[token];
    // **Un token que falta revienta acá y no más adelante.** Dejarlo pasar como
    // `undefined` produce una variable CSS vacía, y una variable vacía no rompe
    // nada: pinta TRANSPARENTE. El síntoma llega a la pantalla y manda a buscar
    // el problema al layout. Lo señaló el tsconfig del server, que es más
    // estricto que el de `shared` — el mismo hueco que cubre el test de «todos
    // los nombres resuelven en los dos modos», ahora también en tipos.
    if (!hex) throw new Error(`Falta el color "${token}" para el modo ${esquema}`);
    salida[clase as NombreDeColor] = hex;
  }
  return salida;
}

/** Las variables CSS de un modo: `--color-primary: 107 56 212`. */
export function variablesDeTema(esquema: Esquema): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [clase, hex] of Object.entries(paletaDe(esquema))) {
    salida[`--color-${clase}`] = hexARgb(hex);
  }
  return salida;
}
