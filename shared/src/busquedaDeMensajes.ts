/**
 * Buscar dentro de las conversaciones. Motor PURO.
 *
 * Búsqueda **por subcadena** (no por palabra entera): quien escribe «cumple»
 * espera encontrar «cumpleaños». Un text index de Mongo hace lo contrario, así
 * que se usa un regex escapado sobre el `body` — para una familia el volumen es
 * chico y alcanza. Lo cifrado NO se busca: el server no tiene el texto.
 */

/** Con 1 carácter el resultado es medio chat; se pide un mínimo. */
const MINIMO = 2;

export function busquedaValida(consulta: string): boolean {
  return consulta.trim().length >= MINIMO;
}

/**
 * Escapa los metacaracteres de regex para buscar el texto **literal**: quien
 * escribe «?» busca ese signo, no «cualquier carácter» —y sin escapar, un «(»
 * suelto rompe el regex y tira la búsqueda entera—.
 */
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type Extracto = { texto: string; desde: number; largo: number };

/**
 * Un trozo del mensaje alrededor de la coincidencia, para mostrar en el
 * resultado sin volcar el mensaje entero. Devuelve además DÓNDE cae el match
 * (`desde`/`largo`) para resaltarlo en la UI.
 */
export function extractoDeCoincidencia(body: string, termino: string, contexto = 30): Extracto {
  const aguja = termino.trim().toLowerCase();
  const idx = body.toLowerCase().indexOf(aguja);
  if (idx < 0) {
    // No debería pasar (el server ya filtró por coincidencia), pero si pasara se
    // muestra el arranque del mensaje sin resaltar nada.
    return { texto: body.slice(0, contexto * 2), desde: -1, largo: 0 };
  }
  const inicio = Math.max(0, idx - contexto);
  const prefijo = inicio > 0 ? '…' : '';
  const fin = Math.min(body.length, idx + aguja.length + contexto);
  const sufijo = fin < body.length ? '…' : '';
  return {
    texto: prefijo + body.slice(inicio, fin) + sufijo,
    desde: prefijo.length + (idx - inicio),
    largo: aguja.length,
  };
}
