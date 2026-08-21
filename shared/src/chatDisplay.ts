/**
 * Lo que el diseño de Stitch pide MOSTRAR en un chat y no estaba: la hora de
 * cada mensaje, el estado de entrega, y el separador de día. Motor PURO.
 *
 * Vive acá y no en el componente porque son decisiones —cuándo es «Hoy», hasta
 * cuándo un mensaje sigue siendo del mismo bloque, qué check corresponde— que
 * la web va a necesitar idénticas en F6.
 */

/** Hora en formato de reloj de 12 h, como en el diseño («10:42 AM»). */
export function formatClock(at: string | Date, locale = 'es-PE'): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
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
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(date);
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
    const day = new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(date);
    return day.charAt(0).toUpperCase() + day.slice(1).replace('.', '');
  }
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })
    .format(date)
    .replace('.', '');
}

/**
 * La línea de vista previa de una fila. El diseño la cambia por completo cuando
 * el otro está escribiendo —cursiva y en acento—, y eso ya lo sabemos: el
 * socket emite `typing` desde F2 y la lista no lo usaba.
 */
export type ChatPreview = { text: string; style: 'normal' | 'typing' };

export function resolveChatPreview(params: {
  typing: boolean;
  lastBody?: string;
  lastKind?: string;
}): ChatPreview {
  if (params.typing) return { text: 'Escribiendo…', style: 'typing' };
  if (params.lastBody) return { text: params.lastBody, style: 'normal' };
  if (params.lastKind && params.lastKind !== 'text') {
    const label =
      params.lastKind === 'image' ? '📷 Foto' : params.lastKind === 'video' ? '🎬 Video' : '📎 Archivo';
    return { text: label, style: 'normal' };
  }
  return { text: 'Sin mensajes todavía', style: 'normal' };
}
