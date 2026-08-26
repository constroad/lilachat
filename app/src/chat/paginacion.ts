/**
 * Cuándo pedir la página anterior de mensajes, y desde dónde.
 *
 * El chat traía UNA página —los últimos 50— y nunca más: scrolleando hacia
 * arriba la conversación se terminaba. El server ya sabía paginar
 * (`beforeSeq`); el cliente nunca se lo pidió.
 *
 * El freno de `cargando` no es un detalle: el evento de «llegué arriba» se
 * dispara en cada cuadro mientras el dedo se mueve, y sin él se piden tres
 * páginas iguales y la lista salta bajo el dedo.
 */

/** Lo mismo que usa el server por defecto. Menos hace pedir demasiado seguido. */
export const TAMANO_PAGINA = 50;

export type DecisionDeCarga =
  | { cargar: false }
  | { cargar: true; beforeSeq: number; limit: number };

export function decidirCargaAnterior(params: {
  mensajes: { seq: number }[];
  cargando: boolean;
  hayMas: boolean;
}): DecisionDeCarga {
  if (params.cargando || !params.hayMas) return { cargar: false };

  // Los optimistas todavía no tienen `seq` del server: van con
  // `MAX_SAFE_INTEGER` y no sirven como límite — pedir «antes de eso» traería
  // la conversación entera otra vez.
  const reales = params.mensajes.filter((mensaje) => mensaje.seq < Number.MAX_SAFE_INTEGER);
  if (reales.length === 0) return { cargar: false };

  const masViejo = reales.reduce((menor, uno) => (uno.seq < menor ? uno.seq : menor), reales[0].seq);

  return { cargar: true, beforeSeq: masViejo, limit: TAMANO_PAGINA };
}
