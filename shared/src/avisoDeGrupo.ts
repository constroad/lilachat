import { textoDeLlamada } from './registroDeLlamada.js';

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
  | 'descripcion'
  | 'recordatorio-suena'
  | 'evento-pronto'
  | 'sumo'
  | 'saco'
  | 'salio'
  | 'admin'
  | 'dejo-admin'
  /** Promoción automática al irse el último admin: no la decidió nadie. */
  | 'admin-auto'
  /** Fijó un mensaje arriba del chat (19/10). */
  | 'fijo'
  /** Someone I invited created their account (José, 21/10, like Telegram). */
  | 'se-unio';

export function textoDeAviso(params: {
  /** Quién lo hizo, con el nombre ya resuelto. */
  quien: string;
  /** Si lo hice yo: entonces la frase va en segunda persona. */
  esMio: boolean;
  evento: EventoDeGrupo | string;
  /** A quién se lo hizo, si aplica. */
  aQuien?: string;
  /** Si me lo hicieron a MÍ (FL9d): «te sacó», no «sacó a» y mi número. */
  aMi?: boolean;
  /** El nombre nuevo, en el cambio de nombre. */
  valor?: string;
}): string {
  const { quien, esMio, aQuien, valor, aMi } = params;

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

    // 20/10: cuando suena un recordatorio o se acerca un evento, también queda en el chat.
    case 'recordatorio-suena':
      return valor ? `⏰ Recordatorio: ${valor}` : '';
    case 'evento-pronto':
      return valor ? `📅 ${valor}` : '';

    // 20/10: el texto no va en el aviso (puede ser largo); está en la info del grupo.
    case 'descripcion':
      if (valor === 'borrada') return esMio ? 'Borraste la descripción del grupo' : `${quien} borró la descripción del grupo`;
      return esMio ? 'Cambiaste la descripción del grupo' : `${quien} cambió la descripción del grupo`;

    case 'sumo':
      if (aMi && !esMio) return `${quien} te agregó`;
      if (!aQuien) return '';
      return esMio ? `Agregaste a ${aQuien}` : `${quien} agregó a ${aQuien}`;

    case 'saco':
      if (aMi && !esMio) return `${quien} te sacó del grupo`;
      if (!aQuien) return '';
      return esMio ? `Sacaste a ${aQuien}` : `${quien} sacó a ${aQuien}`;

    case 'salio':
      return esMio ? 'Saliste del grupo' : `${quien} salió del grupo`;

    case 'admin':
      if (aMi && !esMio) return `${quien} te nombró admin`;
      if (!aQuien) return '';
      return esMio ? `Nombraste admin a ${aQuien}` : `${quien} nombró admin a ${aQuien}`;

    case 'dejo-admin':
      return esMio ? 'Dejaste de ser admin' : `${quien} dejó de ser admin`;

    // **Sin autor a propósito.** Lo hizo el server al irse el último admin;
    // ponerle el nombre de quien se fue sería mentir sobre quién decidió qué.
    case 'admin-auto':
      if (aMi) return 'Quedaste como admin del grupo';
      return aQuien ? `${aQuien} quedó como admin del grupo` : '';

    case 'fijo':
      return esMio ? 'Fijaste un mensaje' : `${quien} fijó un mensaje`;

    case 'se-unio':
      return esMio ? 'Te uniste a Lilachat' : `${quien} se unió a Lilachat`;

    // La línea que deja una llamada (FL8.1): la frase depende de quién mira.
    case 'llamada':
      return textoDeLlamada({ valor, esMio });

    // Un evento que esta versión no conoce —porque el server ya es más nuevo—
    // no se dibuja. Mejor un hueco que una frase inventada.
    default:
      return '';
  }
}

/** Los avisos que se destacan en el chat (con su ícono), no una línea gris más (20/10). */
export function esAvisoDestacado(evento: string | undefined): evento is 'recordatorio-suena' | 'evento-pronto' {
  return evento === 'recordatorio-suena' || evento === 'evento-pronto';
}

/** The highlighted notices, for the server's queries (same list as `esAvisoDestacado`). */
export const HIGHLIGHTED_NOTICE_EVENTS = ['recordatorio-suena', 'evento-pronto'] as const;

/**
 * Whether people can react, reply or open a thread on it (José, 21/10: the
 * reminder showed up and he could not react or reply): any message, and the
 * highlighted notices; the grey notices of the group, no.
 */
export function actsAsMessage(message: { kind?: string; system?: { evento?: string } | null }): boolean {
  return message.kind !== 'system' || esAvisoDestacado(message.system?.evento);
}

/** «Saludar 👋» goes away once I wrote anything after the «se unió» notice (José, 21/10). */
export function alreadyGreeted(messages: readonly { seq?: number; senderId?: string; pending?: boolean }[], noticeSeq: number, me: string): boolean {
  return messages.some((message) => message.senderId === me && (message.pending === true || (message.seq ?? 0) > noticeSeq));
}
