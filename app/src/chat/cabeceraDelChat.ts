import { formatUltimaVez, memberCountLabel, presenceLine, type PresenceStatus } from '@lilachat/shared';

/**
 * El subtítulo de la cabecera de un chat (FL3). En un 1:1, «escribiendo…»,
 * «en línea» o, fuera de línea, la «últ. vez» (FL10). En un grupo dice QUIÉN escribe y, si nadie escribe, quiénes
 * están —como WhatsApp—; sin los nombres cargados no inventa ninguno.
 */
export function subtituloDelChat(params: {
  esGrupo: boolean;
  /** Ids de los que están escribiendo ahora (sin mí). */
  escriben: readonly string[];
  otroEnLinea: boolean;
  /** «Ausente» or «Ocupado», chosen by the other (pending 15). */
  otroEstado?: PresenceStatus;
  nombres: ReadonlyMap<string, string>;
  yo: string;
  /** Cuándo se lo vio por última vez (ISO), si se sabe. Solo en un 1:1. */
  ultimaVez?: string;
  ahora?: Date;
  /** The Slack format (flat rows): a group or channel shows how many are in it, not who. */
  listMode?: boolean;
  /** How many members the server says the chat has, when it is more than the names loaded. */
  totalMembers?: number;
}): string {
  if (!params.esGrupo) {
    if (params.escriben.length > 0) return 'escribiendo…';
    if (params.otroEnLinea) return (presenceLine({ online: true, status: params.otroEstado }) ?? '').toLowerCase();
    return params.ultimaVez ? formatUltimaVez(params.ultimaVez, params.ahora) : '';
  }
  if (params.escriben.length > 0) {
    const quienes = params.escriben.map((id) => params.nombres.get(id)).filter((n): n is string => Boolean(n));
    if (quienes.length === 0) return 'alguien está escribiendo…';
    if (quienes.length === 1) return `${quienes[0]} está escribiendo…`;
    return `${quienes.slice(0, -1).join(', ')} y ${quienes[quienes.length - 1]} están escribiendo…`;
  }
  if (params.listMode) {
    return memberCountLabel(Math.max(params.totalMembers ?? 0, params.nombres.size));
  }
  const otros = [...params.nombres.entries()].filter(([id]) => id !== params.yo).map(([, nombre]) => nombre);
  if (otros.length === 0) return '';
  // Like WhatsApp: a few names, then how many more. Listing everyone made the line shrink to unreadable.
  if (otros.length > MAX_NAMES_SHOWN) return `${otros.slice(0, MAX_NAMES_SHOWN).join(', ')} y ${otros.length - MAX_NAMES_SHOWN} más`;
  return [...otros, 'Tú'].join(', ');
}

/** How many members a group header names before counting the rest. */
const MAX_NAMES_SHOWN = 3;
