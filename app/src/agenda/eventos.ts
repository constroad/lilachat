import { formatClock, formatEventWhen, nombreDeContacto, type AttendeeSummary, type Rsvp } from '@lilachat/shared';

/**
 * Lo que muestra el detalle de un evento (FL10, auditoría §46.3: quien no lo
 * creó no veía quiénes van ni en qué chat, y no había hora de fin). PURO.
 */
type Persona = { phone: string; name?: string };
type Agenda = ReadonlyMap<string, string>;

/** Si no se elige, un evento dura esto. */
const DURACION_POR_DEFECTO_MS = 2 * 3_600_000;

const nombrar = (id: string, personas: Readonly<Record<string, Persona>>, yo: string, agenda: Agenda) => {
  if (id === yo) return 'Tú';
  const persona = personas[id];
  return (persona && nombreDeContacto({ delServidor: persona.name, telefono: persona.phone, agenda })) || 'Alguien';
};

const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** «Hoy, 7:00 p. m. – 10:00 p. m.»; si termina otro día, el fin lleva su fecha. */
export function cuandoDelEvento(startsAt: string, endsAt: string | undefined, ahora: Date = new Date()): string {
  const inicio = new Date(startsAt);
  const desde = formatEventWhen(inicio, ahora);
  if (!endsAt) return desde;
  const fin = new Date(endsAt);
  if (Number.isNaN(fin.getTime()) || fin <= inicio) return desde;
  return `${desde} – ${mismoDia(inicio, fin) ? formatClock(fin) : formatEventWhen(fin, ahora)}`;
}

export function terminaPorDefecto(inicio: Date): Date {
  return new Date(inicio.getTime() + DURACION_POR_DEFECTO_MS);
}

/** «Familia · lo creó Wilson», «Familia · lo creaste tú» o, invitado de afuera, «Wilson te invitó». */
export function origenDelEvento(params: {
  chat?: { kind: 'direct' | 'group'; name?: string; phone?: string };
  creadorId: string;
  invitadoPor?: string;
  personas: Readonly<Record<string, Persona>>;
  yo: string;
  agenda: Agenda;
}): string {
  const { personas, yo, agenda } = params;
  if (!params.chat) return params.invitadoPor ? `${nombrar(params.invitadoPor, personas, yo, agenda)} te invitó` : '';
  const chat =
    params.chat.kind === 'direct'
      ? nombreDeContacto({ delServidor: params.chat.name, telefono: params.chat.phone, agenda })
      : (params.chat.name ?? 'Grupo');
  const quien = params.creadorId === yo ? 'lo creaste tú' : `lo creó ${nombrar(params.creadorId, personas, yo, agenda)}`;
  return `${chat} · ${quien}`;
}

const GRUPOS: { clave: Rsvp | 'pending'; titulo: string }[] = [
  { clave: 'yes', titulo: 'Van' },
  { clave: 'maybe', titulo: 'Tal vez' },
  { clave: 'no', titulo: 'No van' },
  { clave: 'pending', titulo: 'Sin responder' },
];

/** Quiénes van, por respuesta y con «Tú» primero. Los grupos vacíos no salen. */
export function asistentesPorRespuesta(params: {
  asistentes: readonly { userId: string; rsvp?: string }[];
  personas: Readonly<Record<string, Persona>>;
  yo: string;
  agenda: Agenda;
}): { clave: Rsvp | 'pending'; titulo: string; nombres: string[] }[] {
  return GRUPOS.map(({ clave, titulo }) => {
    const ids = params.asistentes.filter((a) => (a.rsvp ?? 'pending') === clave).map((a) => a.userId);
    const ordenados = ids.sort((a, b) => Number(b === params.yo) - Number(a === params.yo));
    return { clave, titulo, nombres: ordenados.map((id) => nombrar(id, params.personas, params.yo, params.agenda)) };
  }).filter((grupo) => grupo.nombres.length > 0);
}

/**
 * Quién va, en una línea: el MISMO texto en la Agenda y en la tarjeta del chat
 * (FL13d; la Agenda decía «1 van»).
 */
export function resumenDeRsvp(resumen: AttendeeSummary): string {
  const van = resumen.yes === 1 ? '1 va' : `${resumen.yes} van`;
  return `${van} · ${resumen.maybe} tal vez · ${resumen.pending} sin responder`;
}
