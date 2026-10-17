/**
 * Links, correos y celulares tocables en un mensaje (FL9; auditoría §46.2: no
 * se tocaba nada). Motor PURO: parte el texto y la burbuja dibuja cada parte.
 */
export type ParteDeTexto =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'url' | 'email' | 'telefono'; texto: string; destino: string };

/**
 * Un link con o sin esquema, un correo, o un CELULAR peruano (9 dígitos que
 * empiezan con 9, con +51 opcional y espacios): un monto o un código de pedido
 * no se vuelven tocables.
 */
const PATRON =
  /(https?:\/\/[^\s]+|www\.[^\s]+)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|((?:\+51\s?)?9\d{2}\s?\d{3}\s?\d{3})(?!\d)/g;
/** Lo que suele cerrar una oración y no es parte del link. */
const PUNTUACION_FINAL = /[.,;:!?)\]]+$/;

export function partirEnEnlaces(texto: string): ParteDeTexto[] {
  const partes: ParteDeTexto[] = [];
  let desde = 0;
  for (const coincidencia of texto.matchAll(PATRON)) {
    const inicio = coincidencia.index ?? 0;
    // Un celular pegado a otra cifra antes (parte de un número largo) no va.
    if (coincidencia[3] && inicio > 0 && /\d/.test(texto[inicio - 1] ?? '')) continue;
    let crudo = coincidencia[0];
    let resto = '';
    if (coincidencia[1]) {
      resto = PUNTUACION_FINAL.exec(crudo)?.[0] ?? '';
      crudo = crudo.slice(0, crudo.length - resto.length);
    }
    if (inicio > desde) partes.push({ tipo: 'texto', texto: texto.slice(desde, inicio) });
    partes.push(parte(crudo, coincidencia));
    desde = inicio + crudo.length;
    if (resto) {
      partes.push({ tipo: 'texto', texto: resto });
      desde += resto.length;
    }
  }
  if (desde < texto.length) partes.push({ tipo: 'texto', texto: texto.slice(desde) });
  return unirTextos(partes);
}

function parte(crudo: string, coincidencia: RegExpMatchArray): ParteDeTexto {
  if (coincidencia[1]) return { tipo: 'url', texto: crudo, destino: crudo.startsWith('www.') ? `https://${crudo}` : crudo };
  if (coincidencia[2]) return { tipo: 'email', texto: crudo, destino: `mailto:${crudo}` };
  return { tipo: 'telefono', texto: crudo, destino: `tel:${crudo.replace(/\s/g, '')}` };
}

/** Dos textos seguidos (por un celular descartado) quedan en uno. */
function unirTextos(partes: ParteDeTexto[]): ParteDeTexto[] {
  const unidas: ParteDeTexto[] = [];
  for (const parte of partes) {
    const ultima = unidas[unidas.length - 1];
    if (parte.tipo === 'texto' && ultima?.tipo === 'texto') ultima.texto += parte.texto;
    else unidas.push({ ...parte });
  }
  return unidas;
}
