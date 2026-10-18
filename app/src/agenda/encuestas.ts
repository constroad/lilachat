import { nombreDeContacto } from '@lilachat/shared';

/**
 * Lo que dice la tarjeta de una encuesta (FL10, auditoría §46.3: no decían de
 * qué chat ni quién preguntó, ni quién votó). PURO. Los nombres salen de MI
 * agenda, como en el resto de la app; el del server es el respaldo.
 */
export type PersonaDeEncuesta = { phone: string; name?: string };
type Agenda = ReadonlyMap<string, string>;

/** Cuántos nombres se muestran antes de «y N más». */
const NOMBRES_VISIBLES = 3;

const nombrar = (persona: PersonaDeEncuesta | undefined, agenda: Agenda) =>
  persona ? nombreDeContacto({ delServidor: persona.name, telefono: persona.phone, agenda }) || 'Alguien' : 'Alguien';

/** «Familia · preguntó Wilson», «Wilson · preguntaste tú» o, en un 1:1, «Wilson te preguntó». */
export function origenDeEncuesta(params: {
  chat?: { kind: 'direct' | 'group'; name?: string; phone?: string };
  autor?: { id: string } & PersonaDeEncuesta;
  yo: string;
  agenda: Agenda;
}): string {
  if (!params.chat || !params.autor) return '';
  const mia = params.autor.id === params.yo;
  if (params.chat.kind === 'direct') {
    if (!mia) return `${nombrar(params.autor, params.agenda)} te preguntó`;
    const otro = nombreDeContacto({ delServidor: params.chat.name, telefono: params.chat.phone, agenda: params.agenda });
    return otro ? `${otro} · preguntaste tú` : 'preguntaste tú';
  }
  const quien = mia ? 'preguntaste tú' : `preguntó ${nombrar(params.autor, params.agenda)}`;
  return `${params.chat.name ?? 'Grupo'} · ${quien}`;
}

/** Quiénes eligieron una opción: «Tú, Wilson, María y 2 más». */
export function votantesDeOpcion(params: {
  votos: readonly string[];
  personas: Readonly<Record<string, PersonaDeEncuesta>>;
  yo: string;
  agenda: Agenda;
  anonima: boolean;
}): string {
  if (params.anonima || params.votos.length === 0) return '';
  const ordenados = [...params.votos].sort((a, b) => Number(b === params.yo) - Number(a === params.yo));
  const nombres = ordenados.map((id) => (id === params.yo ? 'Tú' : nombrar(params.personas[id], params.agenda)));
  if (nombres.length <= NOMBRES_VISIBLES) {
    return nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  }
  return `${nombres.slice(0, NOMBRES_VISIBLES).join(', ')} y ${nombres.length - NOMBRES_VISIBLES} más`;
}

/** El pie: votantes ÚNICOS (con varias respuestas, uno vota dos veces) y si cerró. */
export function resumenDeEncuesta(params: { opciones: readonly { votes: readonly string[] }[]; cerrada: boolean }): string {
  const votantes = new Set(params.opciones.flatMap((opcion) => opcion.votes)).size;
  const cuantos = votantes === 0 ? 'Nadie votó todavía' : `${votantes} ${votantes === 1 ? 'votante' : 'votantes'}`;
  return params.cerrada ? `${cuantos} · Cerrada` : cuantos;
}
