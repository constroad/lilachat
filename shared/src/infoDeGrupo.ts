import type { MiembroDeChat, PuedeAgregar } from './miembrosDeGrupo.js';

/**
 * El nombre y la foto del grupo. PURO.
 *
 * **Editarlos lo puede cualquier miembro**, igual que sumar gente. Es la regla
 * de WhatsApp por defecto y el mismo criterio que ya usa este grupo de
 * funciones: lo que se puede corregir en dos toques y ven todos no necesita
 * pedirle permiso a nadie. Lo que sí pide admin es lo que le SACA algo a otro
 * —echarlo, bajarle el rol—, y cambiar un nombre no le saca nada a nadie.
 */
export function puedeEditarInfo(params: {
  quien: string;
  miembros: readonly MiembroDeChat[];
  esGrupo: boolean;
}): PuedeAgregar {
  // Un 1:1 no tiene nombre ni foto propios: muestra los de la otra persona.
  // Dejar editarlos sería dejarte renombrar a alguien en su propio chat.
  if (!params.esGrupo) {
    return { ok: false, motivo: 'Una conversación de a dos no tiene nombre propio.' };
  }
  if (!params.miembros.some((uno) => uno.userId === params.quien)) {
    return { ok: false, motivo: 'No estás en este grupo.' };
  }
  return { ok: true };
}

/** El tope que muestra el contador al crear el grupo. */
export const MAX_NOMBRE_DE_GRUPO = 25;

export type NombreDeGrupo = { ok: true; nombre: string } | { ok: false; motivo: string };

/**
 * Limpiar y validar el nombre.
 *
 * **Los saltos de línea y los espacios de más se colapsan**, no se rechazan: un
 * `\n` pegado desde otro lado rompe la fila de la lista de chats, y «Los
 * originales» con cuatro espacios en el medio se lee como un error de la app y
 * no de quien lo escribió. Arreglarlo en silencio es mejor que devolver un
 * error por algo que la persona ni ve.
 */
export function normalizarNombreDeGrupo(valor: unknown): NombreDeGrupo {
  if (typeof valor !== 'string') return { ok: false, motivo: 'Ponle un nombre al grupo.' };

  const nombre = valor.replace(/\s+/g, ' ').trim();
  if (!nombre) return { ok: false, motivo: 'Ponle un nombre al grupo.' };
  if ([...nombre].length > MAX_NOMBRE_DE_GRUPO) {
    // Se cuenta por CARACTERES visibles: con `.length` un nombre con emojis
    // se rechazaría por largo mostrando menos letras de las que dice el tope.
    return { ok: false, motivo: `El nombre no puede pasar de ${MAX_NOMBRE_DE_GRUPO} caracteres.` };
  }
  return { ok: true, nombre };
}
