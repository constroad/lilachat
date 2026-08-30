/**
 * Los avisos que aparecen DENTRO del chat cuando cambia algo del grupo. PURO.
 *
 * José, 30/08/2026: «implementá el aviso en el chat cuando cambia algo del
 * grupo». Hasta ahora el grupo se llamaba distinto de un día para el otro y
 * nadie sabía quién lo había cambiado; alguien desaparecía de la lista de
 * participantes sin rastro de si se fue o lo sacaron.
 *
 * **El texto se arma en el TELÉFONO, no en el server.** El server solo conoce el
 * nombre que cada persona se puso; el que quien mira reconoce es el de SU
 * agenda. Por eso el mensaje guarda el evento (`sumo`, `saco`, …) y los ids, y
 * la frase se compone acá con los nombres ya resueltos — el mismo criterio que
 * la lista de chats y la de participantes.
 */
export type EventoDeGrupo =
  | 'nombre'
  | 'foto'
  | 'sumo'
  | 'saco'
  | 'salio'
  | 'admin'
  | 'dejo-admin'
  /** Promoción automática al irse el último admin: no la decidió nadie. */
  | 'admin-auto';

export function textoDeAviso(params: {
  /** Quién lo hizo, con el nombre ya resuelto. */
  quien: string;
  /** Si lo hice yo: entonces la frase va en segunda persona. */
  esMio: boolean;
  evento: EventoDeGrupo | string;
  /** A quién se lo hizo, si aplica. */
  aQuien?: string;
  /** El nombre nuevo, en el cambio de nombre. */
  valor?: string;
}): string {
  const { quien, esMio, aQuien, valor } = params;

  switch (params.evento) {
    case 'nombre':
      // Sin el nombre nuevo no se dice nada: «cambió el nombre a undefined» es
      // peor que el silencio.
      if (!valor) return '';
      return esMio
        ? `Cambiaste el nombre del grupo a «${valor}»`
        : `${quien} cambió el nombre del grupo a «${valor}»`;

    case 'foto':
      return esMio ? 'Cambiaste la foto del grupo' : `${quien} cambió la foto del grupo`;

    case 'sumo':
      if (!aQuien) return '';
      return esMio ? `Agregaste a ${aQuien}` : `${quien} agregó a ${aQuien}`;

    case 'saco':
      if (!aQuien) return '';
      return esMio ? `Sacaste a ${aQuien}` : `${quien} sacó a ${aQuien}`;

    case 'salio':
      return esMio ? 'Saliste del grupo' : `${quien} salió del grupo`;

    case 'admin':
      if (!aQuien) return '';
      return esMio ? `Nombraste admin a ${aQuien}` : `${quien} nombró admin a ${aQuien}`;

    case 'dejo-admin':
      return esMio ? 'Dejaste de ser admin' : `${quien} dejó de ser admin`;

    // **Sin autor a propósito.** Lo hizo el server al irse el último admin;
    // ponerle el nombre de quien se fue sería mentir sobre quién decidió qué.
    case 'admin-auto':
      return aQuien ? `${aQuien} quedó como admin del grupo` : '';

    // Un evento que esta versión no conoce —porque el server ya es más nuevo—
    // no se dibuja. Mejor un hueco que una frase inventada.
    default:
      return '';
  }
}
