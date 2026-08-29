/**
 * Quién puede agregar gente a un grupo y qué pasa cuando alguien se va. PURO.
 *
 * José, 29/08/2026: «implementá el detalle de chat de grupo, no existe». La
 * pantalla sí existía, pero «Añadir» y «Salir del grupo» estaban apagados — y no
 * por pereza de UI: **el server no sabía hacer ninguna de las dos cosas**. Un
 * botón inerte y una capacidad inexistente se ven igual desde afuera, y esa es
 * justamente la trampa de dejar botones apagados «por ahora».
 */
export type RolEnChat = 'admin' | 'member';

export type MiembroDeChat = { userId: string; role: RolEnChat };

export type PuedeAgregar = { ok: true } | { ok: false; motivo: string };

/**
 * Agregar a alguien.
 *
 * **Cualquier miembro puede**, no solo los admins. Es lo que hace WhatsApp por
 * defecto, y en un grupo de trabajo chico pedir permiso para sumar a un
 * compañero convierte al admin en un cuello de botella que nadie pidió. Si algún
 * día hace falta restringirlo, se agrega como ajuste del grupo — no al revés.
 */
export function puedeAgregar(params: {
  quien: string;
  miembros: readonly MiembroDeChat[];
  aQuien: string;
  esGrupo: boolean;
}): PuedeAgregar {
  // Un 1:1 no admite gente: sumar a un tercero lo convertiría en grupo sin que
  // los dos originales lo decidan.
  if (!params.esGrupo) {
    return { ok: false, motivo: 'A una conversación de a dos no se suma gente.' };
  }
  if (!params.miembros.some((m) => m.userId === params.quien)) {
    return { ok: false, motivo: 'No estás en este grupo.' };
  }
  if (params.miembros.some((m) => m.userId === params.aQuien)) {
    return { ok: false, motivo: 'Esa persona ya está en el grupo.' };
  }
  return { ok: true };
}

export type ResultadoDeSalida =
  /** Se va y el grupo sigue. `nuevoAdmin` es a quién hay que promover, si hace falta. */
  | { accion: 'salir'; nuevoAdmin: string | null }
  /** Era el último: el grupo queda sin nadie. */
  | { accion: 'salir-y-vaciar' }
  | { accion: 'imposible'; motivo: string };

/**
 * Qué pasa cuando alguien se va.
 *
 * **El caso que hay que resolver bien es el último admin.** Si se va y no queda
 * ninguno, el grupo sigue existiendo pero nadie puede administrarlo nunca más —
 * un grupo huérfano que solo se arregla desde la base. Se promueve al miembro
 * más antiguo, que es la regla menos sorpresiva: quien está hace más tiempo.
 *
 * NO se le impide salir. Retener a alguien en un grupo porque es el único admin
 * es exactamente el tipo de puerta cerrada que hace desinstalar una app.
 */
export function decidirSalida(params: {
  quien: string;
  /** En orden de antigüedad: el primero es el que entró antes. */
  miembros: readonly MiembroDeChat[];
  esGrupo: boolean;
}): ResultadoDeSalida {
  if (!params.esGrupo) {
    return { accion: 'imposible', motivo: 'De una conversación de a dos no se sale.' };
  }
  if (!params.miembros.some((m) => m.userId === params.quien)) {
    return { accion: 'imposible', motivo: 'No estás en este grupo.' };
  }

  const quedan = params.miembros.filter((m) => m.userId !== params.quien);
  if (quedan.length === 0) return { accion: 'salir-y-vaciar' };

  const quedaAlgunAdmin = quedan.some((m) => m.role === 'admin');
  return {
    accion: 'salir',
    // Solo se promueve si NO queda ningún admin: promover de más le daría
    // permisos a alguien porque otro se fue, que no es lo que nadie espera.
    nuevoAdmin: quedaAlgunAdmin ? null : (quedan[0]?.userId ?? null),
  };
}
