import { normalizePeruPhone } from './phone.js';

/**
 * Preparar los números de MI agenda para preguntar cuáles están registrados.
 *
 * **La dirección de la pregunta es el diseño.** Antes el server devolvía el
 * padrón completo y cualquiera que entrara veía el teléfono de todos. Ahora el
 * teléfono pregunta «¿cuál de estos que YA TENGO está registrado?», así que
 * nadie puede descubrir un número que no tuviera antes.
 *
 * Es el modelo de WhatsApp. La diferencia honesta: los números salen del
 * teléfono para poder emparejarlos —no hay forma de hacerlo sin eso— pero el
 * server **no los guarda**, solo contesta cuáles coinciden.
 */

/**
 * Cuántos se aceptan por consulta.
 *
 * No es cosmético: sin tope, una agenda enorme arma una consulta gigante contra
 * Mongo, y alguien malintencionado manda el espacio entero de números para
 * descubrir a todos los registrados — que es justo lo que este diseño impide.
 */
export const MAX_NUMEROS_POR_CONSULTA = 2000;

export function limpiarNumerosParaEmparejar(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];

  const vistos = new Set<string>();
  for (const crudo of valor) {
    const numero = normalizePeruPhone(crudo);
    if (numero) vistos.add(numero);
    if (vistos.size >= MAX_NUMEROS_POR_CONSULTA) break;
  }

  return [...vistos];
}
