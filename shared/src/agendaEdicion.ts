import type { Recurrence } from './events.js';
import { parseRepeatRule } from './repeatRule.js';
import { parseAdvance } from './reminderAdvance.js';

/**
 * Qué se puede editar de un recordatorio o un evento, y cómo (17/10/2026).
 * PURO: la ruta del server lo aplica tal cual con `$set`/`$unset`.
 *
 * Dos reglas que no son obvias:
 * - **Mover la hora rearma el aviso** (`remindedAt: null`): el cron solo mira
 *   lo que no fue avisado, así que un aviso movido después de sonar no
 *   volvía a sonar nunca. En un recordatorio además se reactiva: quien le
 *   cambia la hora lo quiere encendido.
 * - **Un opcional vacío se borra** (`$unset`), no se guarda como `''`: la
 *   lista muestra la segunda línea si el campo existe.
 *
 * Lo que NO se edita por acá —dueño, chat, invitados, el sello del cron— se
 * ignora en silencio: no es un error del usuario, es un campo que no le toca.
 */
export type Cambios<T> = { ok: true; set: Partial<T>; unset: string[] } | { ok: false; message: string };

type Recordatorio = {
  title: string;
  note: string;
  /** Where it happens (José 25/10): an address, coordinates or a map link. */
  location: string;
  startsAt: Date;
  recurrence: Recurrence;
  remindedAt: null;
  active: boolean;
  /** Minutes before the start that it rings in advance, and the ones that already rang (`reminderAdvance`). */
  advance: number[];
  advanceSent: number[];
};
type Evento = {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  remindedAt: null;
  remindGuests: boolean;
};

const RECURRENCES: readonly string[] = ['once', 'daily', 'weekly', 'monthly'];
/** A location is a line (address, coordinates, link), not a paragraph. */
export const MAX_LOCATION_LENGTH = 200;

const comoObjeto = (cuerpo: unknown): Record<string, unknown> =>
  cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {};

const fecha = (valor: unknown): Date | null => {
  const d = new Date(String(valor ?? ''));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Un texto opcional: con contenido va a `set`; vacío, a `unset`. */
function opcional<T>(cuerpo: Record<string, unknown>, campo: keyof T & string, set: Partial<T>, unset: string[]): void {
  if (!(campo in cuerpo)) return;
  const texto = typeof cuerpo[campo] === 'string' ? (cuerpo[campo] as string).trim() : '';
  if (texto) (set as Record<string, unknown>)[campo] = texto;
  else unset.push(campo);
}

export function cambiosDeRecordatorio(cuerpo: unknown, actual: { startsAt: Date }): Cambios<Recordatorio> {
  const datos = comoObjeto(cuerpo);
  const set: Partial<Recordatorio> = {};
  const unset: string[] = [];

  if ('title' in datos) {
    const titulo = String(datos.title ?? '').trim();
    if (!titulo) return { ok: false, message: 'Escribe de qué es el recordatorio.' };
    set.title = titulo;
  }
  opcional<Recordatorio>(datos, 'note', set, unset);
  opcional<Recordatorio>(datos, 'location', set, unset);
  if ((set.location?.length ?? 0) > MAX_LOCATION_LENGTH) return { ok: false, message: 'La ubicación es muy larga.' };
  // Changing the advances (or the hour, below) re-arms them: none counts as already rung.
  if ('advance' in datos) {
    const advance = parseAdvance(datos.advance);
    if (advance.length > 0) set.advance = advance;
    else unset.push('advance');
    set.advanceSent = [];
  }
  if ('recurrence' in datos) {
    if (!RECURRENCES.includes(String(datos.recurrence))) return { ok: false, message: 'Repetición inválida.' };
    set.recurrence = datos.recurrence as Recurrence;
  }
  // Pending 65: the repeat rule (weekdays, the month's last day, every N); an empty one is cleared.
  if ('repeat' in datos) {
    const rule = parseRepeatRule(datos.repeat);
    if (rule) Object.assign(set, { repeat: rule });
    else unset.push('repeat');
  }
  if ('startsAt' in datos) {
    const inicio = fecha(datos.startsAt);
    if (!inicio) return { ok: false, message: 'Elige cuándo.' };
    if (inicio.getTime() !== actual.startsAt.getTime()) {
      Object.assign(set, { startsAt: inicio, remindedAt: null, active: true, advanceSent: [] });
    }
  }
  return { ok: true, set, unset };
}

export function cambiosDeEvento(cuerpo: unknown, actual: { startsAt: Date }): Cambios<Evento> {
  const datos = comoObjeto(cuerpo);
  const set: Partial<Evento> = {};
  const unset: string[] = [];

  if ('title' in datos) {
    const titulo = String(datos.title ?? '').trim();
    if (!titulo) return { ok: false, message: 'Ponle un nombre al evento.' };
    set.title = titulo;
  }
  opcional<Evento>(datos, 'description', set, unset);
  opcional<Evento>(datos, 'location', set, unset);
  if (typeof datos.remindGuests === 'boolean') set.remindGuests = datos.remindGuests;

  let inicio = actual.startsAt;
  if ('startsAt' in datos) {
    const nuevo = fecha(datos.startsAt);
    if (!nuevo) return { ok: false, message: 'Elige cuándo es.' };
    if (nuevo.getTime() !== actual.startsAt.getTime()) Object.assign(set, { startsAt: nuevo, remindedAt: null });
    inicio = nuevo;
  }
  if ('endsAt' in datos) {
    if (datos.endsAt === null || datos.endsAt === '') unset.push('endsAt');
    else {
      const fin = fecha(datos.endsAt);
      if (!fin || fin.getTime() <= inicio.getTime()) {
        return { ok: false, message: 'La hora de fin tiene que ser después del inicio.' };
      }
      set.endsAt = fin;
    }
  }
  return { ok: true, set, unset };
}
