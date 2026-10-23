import type { AttendeeSummary, Recurrence, Rsvp } from './events.js';
import type { RepeatRule } from './repeatRule.js';

/**
 * La agenda como la manda el server (`server/src/eventRoutes.ts`), una sola
 * vez para la app y la web (W3c, 19/10). Antes cada cliente tenía su copia y
 * la de la web había quedado sin `mio`, `esMia` ni los asistentes.
 */
export type ChatDeOrigen = { kind: 'direct' | 'group'; name?: string; phone?: string };
type Personas = Record<string, { phone: string; name?: string }>;

export type AgendaEvent = {
  id: string;
  chatId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  rsvpSummary: AttendeeSummary;
  myRsvp: Rsvp | null;
  /** Lo creé yo: solo entonces se ofrece editarlo y cancelarlo. */
  mio: boolean;
  /** «Avisar 1 hora antes»; los eventos viejos no lo traen y cuentan como sí. */
  remindGuests?: boolean;
  /** Lo que el detalle muestra a todos (FL10). Un server viejo no lo manda. */
  createdBy?: string;
  attendees?: { userId: string; rsvp?: Rsvp; invitedBy?: string }[];
  chat?: ChatDeOrigen;
  personas?: Personas;
  guestsCanInvite?: boolean;
  puedoInvitar?: boolean;
  /** A scheduled call (pending 42): its card offers «Unirse». */
  call?: { video: boolean };
};

export type AgendaReminder = {
  _id: string;
  title: string;
  /** La segunda línea de la tarjeta del diseño («Cada 2 horas»). */
  note?: string;
  startsAt: string;
  recurrence: Recurrence;
  /** Weekdays, the month's last day, every N (pending 65). */
  repeat?: RepeatRule;
  active: boolean;
  /** Solo en los del grupo (19/10): el chat donde vive y su imagen. */
  chatId?: string;
  imageUrl?: string;
  /** El chat visible, en la línea de «Pendientes» (20/10): el grupo por su nombre; el 1:1, por el otro. */
  chat?: ChatDeOrigen;
};

export type AgendaPoll = {
  id: string;
  chatId: string;
  question: string;
  options: { text: string; votes: string[] }[];
  allowMultiple: boolean;
  anonymous: boolean;
  closedAt?: string | null;
  /** De qué chat y quién preguntó (FL10). Un server viejo no los manda. */
  chat?: ChatDeOrigen;
  autor?: { id: string; phone: string; name?: string };
  /** La creé yo: solo entonces se cierra o se elimina. */
  esMia?: boolean;
  /** Para nombrar al autor y, si no es anónima, a los votantes. */
  personas?: Personas;
};

/** Lo que me espera, para los contadores (`GET /pendientes`, 18/10). */
export type PendientesDeAgenda = { encuestas: number; eventos: number };
