/**
 * Cómo se reparte la pantalla (FL10, auditoría §46.3: la app estaba fija en
 * vertical). PURO: recibe el tamaño en dp de `useWindowDimensions`, nunca un
 * `Dimensions.get` al montar, que no se entera del giro.
 *
 * - `apaisada`: más ancha que alta.
 * - `tablet`: el lado corto llega a 600 dp.
 * - `amplia`: tablet o teléfono girado. Las pestañas pasan a un riel a la
 *   izquierda (girado, la altura no alcanza para cabecera y barra abajo) y el
 *   contenido se centra con un ancho máximo.
 * - `dosPaneles`: la lista y el chat lado a lado, como WhatsApp en tablet.
 *   Hace falta tablet Y ancho para los dos.
 */
export type Disposicion = { apaisada: boolean; tablet: boolean; amplia: boolean; dosPaneles: boolean };

/** El lado corto desde el que un aparato es tablet (dp). */
const LADO_CORTO_DE_TABLET = 600;
/** El ancho de la lista en dos paneles (dp). */
export const ANCHO_DE_LISTA = 380;
/** Lo mínimo que necesita el chat al lado de la lista (dp). */
const ANCHO_MINIMO_DEL_CHAT = 340;
/** Más ancho que esto, una lista o un formulario se lee mal: se centra (dp). */
export const ANCHO_MAXIMO_DE_CONTENIDO = 720;
/** La entrada (teléfono y código) en tablet: seis casillas no se reparten en 1280 dp. */
export const ANCHO_MAXIMO_DE_FORMULARIO = 480;

export function disposicion(tamano: { ancho: number; alto: number }): Disposicion {
  const apaisada = tamano.ancho > tamano.alto;
  const tablet = Math.min(tamano.ancho, tamano.alto) >= LADO_CORTO_DE_TABLET;
  return {
    apaisada,
    tablet,
    amplia: tablet || apaisada,
    dosPaneles: tablet && tamano.ancho >= ANCHO_DE_LISTA + ANCHO_MINIMO_DEL_CHAT,
  };
}
