/** Hasta dónde se muestra un mensaje antes de «Leer más» (como WhatsApp). */
const MAX_CARACTERES = 700;
const MAX_LINEAS = 15;
/** Se busca un espacio para cortar en las últimas letras antes del tope; si no hay, se corta ahí. */
const MARGEN_PARA_LA_PALABRA = 80;

/**
 * Un mensaje largo colapsado (José, 19/10): hasta 700 caracteres o 15 líneas,
 * cortado en una palabra y con «…». Puro: la burbuja decide si lo despliega.
 */
export function recorteDeMensaje(texto: string): { recortado: boolean; texto: string } {
  const lineas = texto.split('\n');
  let corte = lineas.length > MAX_LINEAS ? lineas.slice(0, MAX_LINEAS).join('\n') : texto;
  if (corte.length > MAX_CARACTERES) {
    const espacio = corte.lastIndexOf(' ', MAX_CARACTERES);
    corte = corte.slice(0, espacio > MAX_CARACTERES - MARGEN_PARA_LA_PALABRA ? espacio : MAX_CARACTERES);
  }
  if (corte.length === texto.length) return { recortado: false, texto };
  return { recortado: true, texto: `${corte.trimEnd()}…` };
}
