/**
 * Lo puro del deslizar-para-responder (FL2b). Corre en el hilo de UI como
 * worklet de Reanimated, por eso la directiva; en los tests es una función más.
 */

/** Cuánto hay que deslizar para que suelte en «responder» (dp). */
export const UMBRAL_RESPUESTA = 48;
/** Hasta dónde se deja arrastrar la burbuja (dp). */
export const MAX_DESPLAZAMIENTO = 72;

/** El desplazamiento que se dibuja: solo a la derecha y con tope. */
export function desplazamientoVisible(dx: number): number {
  'worklet';
  return Math.max(0, Math.min(dx, MAX_DESPLAZAMIENTO));
}

/** Si al soltar corresponde responder. */
export function cruzoElUmbral(dx: number): boolean {
  'worklet';
  return dx >= UMBRAL_RESPUESTA;
}
