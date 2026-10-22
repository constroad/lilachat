import { nombreDeContacto, type MemberPill } from '@lilachat/shared';

export type MiembroConNombre = { id: string; name: string | null; phone: string | null; avatarUrl?: string; role?: 'admin' | 'member' };
/** What a company space's chat adds to each member: the job title and the role there (design s-01). */
export type SpaceMemberFields = { title?: string; spaceRole?: string; /** An installed app (Lila): its pill says «App». */ app?: boolean };

/** A member's pill: the space's job title and role when there are, else the chat's role. */
export function pillOf(member: MiembroConNombre & SpaceMemberFields): MemberPill {
  return { role: member.app ? 'app' : (member.spaceRole ?? member.role ?? 'member'), title: member.title };
}

/**
 * El nombre con que se muestra cada miembro de un grupo (FL3): gana TU agenda,
 * después el nombre que se puso en Lilachat, y si no hay nada el teléfono.
 * Mismo criterio que la lista y la cabecera, para que «Mamá» sea «Mamá» en
 * todos lados.
 */
export function nombresPorMiembro(
  miembros: readonly MiembroConNombre[],
  agenda: ReadonlyMap<string, string>
): Map<string, string> {
  const nombres = new Map<string, string>();
  for (const miembro of miembros) {
    const nombre = nombreDeContacto({ delServidor: miembro.name, telefono: miembro.phone, agenda });
    nombres.set(miembro.id, nombre || miembro.phone || 'Alguien');
  }
  return nombres;
}

/** La foto de cada miembro que tiene una (FL13d): el autor de cada burbuja del grupo. */
export function fotosPorMiembro(miembros: readonly MiembroConNombre[]): Map<string, string> {
  return new Map(miembros.flatMap((miembro) => (miembro.avatarUrl ? [[miembro.id, miembro.avatarUrl] as const] : [])));
}

/**
 * ¿Sigo siendo miembro, según la respuesta del detalle del grupo? Solo un
 * «no» explícito (403/404) dice que no: sin red, con 401 (la sesión se
 * renueva aparte) o con un error del server, `null` —no se sabe y se sigue
 * como estaba—.
 */
export function membresiaPorRespuesta(status: number | 'sin-red'): boolean | null {
  if (status === 'sin-red') return null;
  if (status >= 200 && status < 300) return true;
  if (status === 403 || status === 404) return false;
  return null;
}
