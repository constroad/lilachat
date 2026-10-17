/**
 * Las cuentas del visor (17/10/2026). Puras —sin `react-native`— para que
 * corran en los tests y, marcadas `'worklet'`, también en el hilo de UI.
 */
export const ZOOM_MAXIMO = 4;
export const ZOOM_DOBLE_TOQUE = 2.5;
/** Debajo de esto el zoom cuenta como «sin zoom» (el pellizco nunca vuelve justo a 1). */
const UMBRAL_SIN_ZOOM = 1.1;
/** Cuánto hay que arrastrar en vertical para que soltar cierre (dp). */
const DISTANCIA_PARA_CERRAR = 140;
/** Un tirón más rápido que esto cierra aunque la distancia sea corta (dp/s). */
const VELOCIDAD_PARA_CERRAR = 1000;

/** La posición de una foto por su `seq`; si ya no está, la última. */
export function indiceDeFoto(lista: readonly { seq: number }[], seq: number): number {
  const indice = lista.findIndex((foto) => foto.seq === seq);
  return indice >= 0 ? indice : Math.max(0, lista.length - 1);
}

export function debeCerrar(gesto: { dy: number; vy: number }): boolean {
  'worklet';
  return Math.abs(gesto.dy) > DISTANCIA_PARA_CERRAR || Math.abs(gesto.vy) > VELOCIDAD_PARA_CERRAR;
}

export function zoomAcotado(zoom: number): number {
  'worklet';
  return Math.min(ZOOM_MAXIMO, Math.max(1, zoom));
}

export function zoomDelDobleToque(zoomActual: number): number {
  'worklet';
  return zoomActual < UMBRAL_SIN_ZOOM ? ZOOM_DOBLE_TOQUE : 1;
}

/**
 * Con zoom, la imagen se puede correr hasta que su borde toque el de la
 * pantalla: más allá se vería el negro de afuera.
 */
export function desplazamientoPermitido(params: { desplazamiento: number; zoom: number; lado: number }): number {
  'worklet';
  const maximo = (params.lado * (params.zoom - 1)) / 2;
  return Math.min(maximo, Math.max(-maximo, params.desplazamiento));
}
