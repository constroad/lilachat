/**
 * El nombre del perfil (FL9; auditoría §46.2: no había cómo ponerse nombre ni
 * foto, y quien no te tiene agendado veía solo tu número). Lo validan igual la
 * app —para avisar en el campo— y el server —que es quien manda—.
 */
export const MAX_NOMBRE_DE_PERFIL = 25;

export function validarNombreDePerfil(texto: unknown): { ok: true; nombre: string } | { ok: false; motivo: string } {
  if (typeof texto !== 'string') return { ok: false, motivo: 'Escribe tu nombre.' };
  const nombre = texto.replace(/\s+/g, ' ').trim();
  if (!nombre) return { ok: false, motivo: 'Escribe tu nombre.' };
  if ([...nombre].length > MAX_NOMBRE_DE_PERFIL) {
    return { ok: false, motivo: `Hasta ${MAX_NOMBRE_DE_PERFIL} letras.` };
  }
  return { ok: true, nombre };
}
