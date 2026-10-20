import { nextOccurrence, type Rsvp } from './events.js';
import { nombreDeContacto } from './nombreDeContacto.js';
import type { AgendaEvent, AgendaReminder, ChatDeOrigen } from './tiposDeAgenda.js';

/**
 * «Pendientes» (José aprobó el 20/10; reemplaza a «Agenda»): eventos y
 * recordatorios en UNA línea, por cuándo tocan. Motor puro para la app y la
 * web. «Vencidos» = los de una vez que ya sonaron (el server manda los de las
 * últimas 24 h y después se van solos).
 */
export type ClaveDeSeccion = 'vencidos' | 'hoy' | 'manana' | 'semana' | 'despues';

export type ItemDePendientes =
  | { tipo: 'evento'; id: string; cuando: Date; evento: AgendaEvent }
  | { tipo: 'recordatorio'; id: string; cuando: Date; recordatorio: AgendaReminder };

export type SeccionDePendientes = { clave: ClaveDeSeccion; titulo: string; items: ItemDePendientes[] };

const TITULOS: Record<ClaveDeSeccion, string> = {
  vencidos: 'Vencidos',
  hoy: 'Hoy',
  manana: 'Mañana',
  semana: 'Esta semana',
  despues: 'Más adelante',
};
const ORDEN: ClaveDeSeccion[] = ['vencidos', 'hoy', 'manana', 'semana', 'despues'];
const DIAS_DE_LA_SEMANA = 7;
const DIA_MS = 86_400_000;

const inicioDelDia = (fecha: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();

/** Días de calendario (hora local) entre hoy y la fecha. */
function diasHasta(fecha: Date, ahora: Date): number {
  return Math.round((inicioDelDia(fecha) - inicioDelDia(ahora)) / DIA_MS);
}

function seccionDe(cuando: Date, ahora: Date): ClaveDeSeccion | null {
  const dias = diasHasta(cuando, ahora);
  if (dias < 0) return null;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  return dias < DIAS_DE_LA_SEMANA ? 'semana' : 'despues';
}

/** La PRÓXIMA vez que suena; uno de una vez ya vencido y todavía activo, en su hora. */
function proximaVez(recordatorio: AgendaReminder, ahora: Date): Date {
  const inicio = new Date(recordatorio.startsAt);
  return nextOccurrence({ startsAt: inicio, recurrence: recordatorio.recurrence, from: ahora }) ?? inicio;
}

export function lineaDePendientes(params: { eventos: readonly AgendaEvent[]; recordatorios: readonly AgendaReminder[]; vencidos: readonly AgendaReminder[]; ahora: Date }): SeccionDePendientes[] {
  const { ahora } = params;
  const porSeccion = new Map<ClaveDeSeccion, ItemDePendientes[]>(ORDEN.map((clave) => [clave, []]));
  const agregar = (item: ItemDePendientes) => {
    const clave = seccionDe(item.cuando, ahora);
    if (clave) porSeccion.get(clave)!.push(item);
  };
  for (const evento of params.eventos) agregar({ tipo: 'evento', id: evento.id, cuando: new Date(evento.startsAt), evento });
  for (const recordatorio of params.recordatorios) agregar({ tipo: 'recordatorio', id: recordatorio._id, cuando: proximaVez(recordatorio, ahora), recordatorio });
  porSeccion.set(
    'vencidos',
    params.vencidos.map((recordatorio) => ({ tipo: 'recordatorio' as const, id: recordatorio._id, cuando: new Date(recordatorio.startsAt), recordatorio }))
  );

  return ORDEN.flatMap((clave) => {
    const items = porSeccion.get(clave)!;
    if (items.length === 0) return [];
    // Vencidos: el más reciente arriba. El resto: lo que toca antes, arriba.
    items.sort((a, b) => (clave === 'vencidos' ? b.cuando.getTime() - a.cuando.getTime() : a.cuando.getTime() - b.cuando.getTime()));
    return [{ clave, titulo: TITULOS[clave], items }];
  });
}

/** De dónde viene un recordatorio de la línea: mío, de un grupo o de un 1:1 (con el nombre de MI agenda). */
export function origenDelRecordatorio(params: { chat?: ChatDeOrigen; agenda: ReadonlyMap<string, string> }): string {
  if (!params.chat) return 'Solo para ti';
  if (params.chat.kind === 'group') return `En «${params.chat.name ?? 'Grupo'}»`;
  return `Con ${nombreDeContacto({ delServidor: params.chat.name, telefono: params.chat.phone, agenda: params.agenda })}`;
}

export type TonoDelEstado = 'propio' | 'pendiente' | 'ok' | 'neutro';
const RESPUESTA: Record<Rsvp, { texto: string; tono: TonoDelEstado }> = {
  yes: { texto: 'Voy', tono: 'ok' },
  maybe: { texto: 'Tal vez', tono: 'neutro' },
  no: { texto: 'No voy', tono: 'neutro' },
};

/** La pastilla de un evento en la línea (diseño `w3c-web-agenda`). */
export function estadoDelEvento(evento: { mio: boolean; myRsvp: Rsvp | null }): { texto: string; tono: TonoDelEstado } {
  if (evento.mio) return { texto: 'Creado por ti', tono: 'propio' };
  return evento.myRsvp ? RESPUESTA[evento.myRsvp] : { texto: 'Sin responder', tono: 'pendiente' };
}
