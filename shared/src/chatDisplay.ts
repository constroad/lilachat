import { TEXTO_ELIMINADO } from './eliminarMensaje.js';
/**
 * Lo que el diseño de Stitch pide MOSTRAR en un chat y no estaba: la hora de
 * cada mensaje, el estado de entrega, y el separador de día. Motor PURO.
 *
 * Vive acá y no en el componente porque son decisiones —cuándo es «Hoy», hasta
 * cuándo un mensaje sigue siendo del mismo bloque, qué check corresponde— que
 * la web va a necesitar idénticas en F6.
 */

/**
 * Los formateadores se crean UNA vez (FL12, §49 #8). En Hermes construir un
 * `Intl.DateTimeFormat` va a ICU y es caro, y estas funciones corren por fila
 * y por render: crearlo en cada llamada era trabajo constante en el hilo JS.
 */
const relojes = new Map<string, Intl.DateTimeFormat>();
const relojDe = (locale: string): Intl.DateTimeFormat => {
  let reloj = relojes.get(locale);
  if (!reloj) {
    reloj = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
    relojes.set(locale, reloj);
  }
  return reloj;
};
let diaYMes: Intl.DateTimeFormat | null = null;
const diaYMesDe = () => (diaYMes ??= new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }));
let diaDeLaSemana: Intl.DateTimeFormat | null = null;
const diaDeLaSemanaDe = () => (diaDeLaSemana ??= new Intl.DateTimeFormat('es-PE', { weekday: 'short' }));

/** Hora en formato de reloj de 12 h, como en el diseño («10:42 AM»). */
export function formatClock(at: string | Date, locale = 'es-PE'): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return relojDe(locale).format(date);
}

/**
 * El separador de día que el diseño pone centrado en un chip («Today»).
 * Se compara por día CALENDARIO local, nunca por diferencia de horas: a las
 * 00:30 el mensaje de las 23:50 es de ayer, aunque hayan pasado 40 minutos.
 */
export function formatDayLabel(at: string | Date, now: Date = new Date()): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Ayer';
  return diaYMesDe().format(date);
}

/**
 * «últ. vez» de un 1:1 (FL10), como WhatsApp: «últ. vez hoy a las 7:31 a. m.».
 * El día sale de `formatDayLabel` (calendario local); la una va en singular.
 */
export function formatUltimaVez(at: string | Date, now: Date = new Date()): string {
  const reloj = formatClock(at);
  if (!reloj) return '';
  // Corta, para que quepa en la cabecera con video, llamada y menú (FL13d):
  // hoy solo la hora, ayer «ayer» y la hora, antes solo el día.
  const dia = formatDayLabel(at, now);
  if (dia === 'Hoy') return `últ. vez ${reloj}`;
  if (dia === 'Ayer') return `últ. vez ayer ${reloj}`;
  return `últ. vez ${dia}`;
}

/** ¿Este mensaje abre un día nuevo respecto del anterior? */
export function startsNewDay(current: string | Date, previous?: string | Date): boolean {
  if (!previous) return true;
  const a = current instanceof Date ? current : new Date(current);
  const b = previous instanceof Date ? previous : new Date(previous);
  return a.toDateString() !== b.toDateString();
}

export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'read';

/**
 * El check de un mensaje PROPIO (el diseño lo dibuja junto a la hora).
 *
 * Sale de los acuses que el server ya lleva como cursor: «hasta qué `seq` leyó
 * el otro». Un mensaje con `seq` menor o igual a ese cursor está leído. Los
 * acuses existían desde F2 y la pantalla no los mostraba — que es justo lo que
 * este módulo viene a arreglar.
 */
export function resolveDeliveryState(params: {
  seq: number | null;
  otherReadSeq: number;
  otherDeliveredSeq: number;
}): DeliveryState {
  if (params.seq === null) return 'pending';
  if (params.seq <= params.otherReadSeq) return 'read';
  if (params.seq <= params.otherDeliveredSeq) return 'delivered';
  return 'sent';
}

/** Los glifos, en un solo lugar: la pantalla no inventa símbolos. */
export const DELIVERY_GLYPH: Record<DeliveryState, string> = {
  pending: '🕐',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
};

/**
 * ¿Se agrupa con el mensaje anterior? El diseño pega los del mismo emisor
 * (8 px) y separa al cambiar (16 px), y solo el ÚLTIMO del bloque lleva la
 * cola de la burbuja.
 */
export function groupsWithPrevious(params: {
  senderId: string;
  at: string | Date;
  previousSenderId?: string;
  previousAt?: string | Date;
  /** Un silencio largo corta el bloque aunque hable el mismo. */
  maxGapMinutes?: number;
}): boolean {
  if (!params.previousSenderId || params.previousSenderId !== params.senderId) return false;
  if (!params.previousAt) return false;
  const current = params.at instanceof Date ? params.at : new Date(params.at);
  const previous = params.previousAt instanceof Date ? params.previousAt : new Date(params.previousAt);
  if (current.toDateString() !== previous.toDateString()) return false;
  const gapMinutes = Math.abs(current.getTime() - previous.getTime()) / 60_000;
  return gapMinutes <= (params.maxGapMinutes ?? 5);
}

/**
 * La marca de tiempo de la LISTA de chats. El diseño no usa el reloj para todo:
 * muestra «10:42 AM» lo de hoy, «Ayer», el día de la semana dentro de la semana
 * («Lun», «Dom») y la fecha más atrás («12 Feb»).
 *
 * No es cosmético: con el reloj en todas las filas, una conversación de hace
 * tres semanas y una de hace diez minutos se ven exactamente igual.
 */
export function formatChatTimestamp(at: string | Date, now: Date = new Date()): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const daysApart = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (daysApart <= 0) return formatClock(date);
  if (daysApart === 1) return 'Ayer';
  if (daysApart < 7) {
    const day = diaDeLaSemanaDe().format(date);
    return day.charAt(0).toUpperCase() + day.slice(1).replace('.', '');
  }
  return diaYMesDe().format(date).replace('.', '');
}

/**
 * La línea de vista previa de una fila. El diseño la cambia por completo cuando
 * el otro está escribiendo —cursiva y en acento—, y eso ya lo sabemos: el
 * socket emite `typing` desde F2 y la lista no lo usaba.
 */
export type MediaDePreview = 'foto' | 'video' | 'voz' | 'archivo' | 'encuesta' | 'evento' | 'recordatorio' | 'sticker';

const ETIQUETA_DE_MEDIA: Record<MediaDePreview, string> = {
  foto: 'Foto',
  video: 'Video',
  voz: 'Nota de voz',
  archivo: 'Archivo',
  encuesta: 'Encuesta',
  evento: 'Evento',
  recordatorio: 'Recordatorio',
  sticker: 'Sticker',
};

/** Los mensajes que se dibujan como tarjeta y su ícono en la lista. */
const MEDIA_DE_TARJETA: Record<string, MediaDePreview> = { poll: 'encuesta', event: 'evento', reminder: 'recordatorio' };

/** El prefijo que lleva el texto de una encuesta o un evento en el chat (`enElChat`). */
const PREFIJO_DE_REF = /^(Encuesta|Evento|Recordatorio):\s*/;

export type ChatPreview = {
  text: string;
  /** `eliminado` (19/10): el último se borró para todos; va en cursiva, como la burbuja. */
  style: 'normal' | 'typing' | 'borrador' | 'eliminado';
  media?: MediaDePreview;
  /** Va antes del texto y en el color de la marca: «Borrador:» (FL9). */
  etiqueta?: string;
};

export function resolveChatPreview(params: {
  typing: boolean;
  lastBody?: string;
  lastKind?: string;
  /** Lo escrito y no mandado en ese chat (FL9), como «Borrador:» de WhatsApp. */
  borrador?: string;
  /** El último mensaje se borró para todos: su tipo ya no dice nada (una foto borrada no es «Foto»). */
  eliminado?: boolean;
  /** E3: el último fue una respuesta en un hilo. */
  enHilo?: boolean;
}): ChatPreview {
  if (params.typing) return { text: 'Escribiendo…', style: 'typing' };
  // En una sola línea: un salto cortaría la vista previa en la primera.
  const borrador = params.borrador?.replace(/\s+/g, ' ').trim();
  if (borrador) return { etiqueta: 'Borrador:', text: borrador, style: 'borrador' };
  if (params.eliminado) return { text: TEXTO_ELIMINADO, style: 'eliminado' };
  // Encuesta o evento publicados en el chat (18/10): su ícono y la pregunta o
  // el título, como WhatsApp. El prefijo del texto sobra al lado del ícono.
  const media = params.lastKind ? MEDIA_DE_TARJETA[params.lastKind] : undefined;
  if (media) {
    return { text: (params.lastBody ?? '').replace(PREFIJO_DE_REF, '') || ETIQUETA_DE_MEDIA[media], style: 'normal', media };
  }
  if (params.lastBody) return { text: params.enHilo ? `En un hilo: ${params.lastBody}` : params.lastBody, style: 'normal' };
  // The MSN nudge (backlog 3): no content, just what happened.
  if (params.lastKind === 'zumbido') return { text: 'Zumbido', style: 'normal' };
  if (params.lastKind && params.lastKind !== 'text') {
    // El tipo va aparte (FL3): la app dibuja un ícono vectorial como WhatsApp;
    // con el emoji pegado al texto se veía distinto en cada teléfono.
    const media: MediaDePreview =
      params.lastKind === 'sticker'
        ? 'sticker'
        : params.lastKind === 'image'
        ? 'foto'
        : params.lastKind === 'video'
          ? 'video'
          : params.lastKind === 'audio'
            ? 'voz'
            : 'archivo';
    return { text: ETIQUETA_DE_MEDIA[media], style: 'normal', media };
  }
  return { text: 'Sin mensajes todavía', style: 'normal' };
}

/**
 * ¿Este acuse de lectura es de OTRA persona?
 *
 * El server emite `receipt` a todos los miembros del chat, incluido quien
 * acaba de leer. Sin este filtro, al abrir un chat —donde la app se marca leída
 * sola— mi propio acuse subía «hasta dónde leyeron los demás» y todos mis
 * mensajes se pintaban con el doble check azul al instante, con el otro lado sin
 * haber visto nada. Los checks dejaban de significar algo.
 */
export function esAcuseDeOtro(params: { de: string; yo: string }): boolean {
  if (!params.yo) return false;
  return params.de !== params.yo;
}
