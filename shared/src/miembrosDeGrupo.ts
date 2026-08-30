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

/**
 * Sacar a alguien del grupo.
 *
 * **No es simétrico con sumar, y eso es a propósito.** Sumar lo puede hacer
 * cualquier miembro; sacar, solo un admin. Si un miembro común pudiera echar
 * gente, cualquiera podría vaciar el grupo —o echar al admin— y no quedaría a
 * quién reclamarle.
 *
 * Dos límites más, por el mismo motivo:
 *
 * - **Entre admins no se echan.** Si no, el grupo lo decide quien toca primero:
 *   dos admins enojados se sacan mutuamente en una carrera. Para que se vaya un
 *   admin, se le pide que salga.
 * - **A uno mismo no se saca**: eso es salir, y salir tiene sus propias reglas
 *   (promover al más antiguo si era el último admin).
 */
export function puedeSacar(params: {
  quien: string;
  miembros: readonly MiembroDeChat[];
  aQuien: string;
  esGrupo: boolean;
}): PuedeAgregar {
  if (!params.esGrupo) {
    return { ok: false, motivo: 'De una conversación de a dos no se saca a nadie.' };
  }

  const yo = params.miembros.find((uno) => uno.userId === params.quien);
  if (!yo) return { ok: false, motivo: 'No estás en este grupo.' };

  if (params.aQuien === params.quien) {
    return { ok: false, motivo: 'Para irte del grupo usá «Salir del grupo».' };
  }

  const victima = params.miembros.find((uno) => uno.userId === params.aQuien);
  if (!victima) return { ok: false, motivo: 'Esa persona ya no está en el grupo.' };

  if (yo.role !== 'admin') {
    return { ok: false, motivo: 'Solo un admin puede sacar a alguien del grupo.' };
  }
  if (victima.role === 'admin') {
    return { ok: false, motivo: 'No podés sacar a otro admin. Pedile que salga.' };
  }

  return { ok: true };
}

/**
 * Nombrar admin, o dejar de serlo.
 *
 * **El admin se lo saca uno mismo; nadie se lo saca a otro.** Es la misma
 * simetría que en `puedeSacar`, y acá importa más: si un admin pudiera degradar
 * a otro, después podría echarlo — dos toques y el grupo cambió de dueño.
 * Nombrar SÍ lo puede hacer cualquier admin: dar permisos no le quita nada a
 * nadie.
 *
 * Y **el grupo nunca se queda sin admin**: el único no puede renunciar. Es el
 * mismo agujero que tapa `decidirSalida` al irse el último, pero acá no se
 * promueve a nadie por su cuenta —quien está mirando la lista puede elegir— así
 * que se le pide nombrar reemplazo antes.
 */
export function puedeCambiarRol(params: {
  quien: string;
  miembros: readonly MiembroDeChat[];
  aQuien: string;
  rol: RolEnChat;
  esGrupo: boolean;
}): PuedeAgregar {
  if (!params.esGrupo) {
    return { ok: false, motivo: 'En una conversación de a dos no hay admins.' };
  }

  const yo = params.miembros.find((uno) => uno.userId === params.quien);
  if (!yo) return { ok: false, motivo: 'No estás en este grupo.' };
  if (yo.role !== 'admin') {
    return { ok: false, motivo: 'Solo un admin puede cambiar los roles.' };
  }

  const otro = params.miembros.find((uno) => uno.userId === params.aQuien);
  if (!otro) return { ok: false, motivo: 'Esa persona ya no está en el grupo.' };

  if (otro.role === params.rol) {
    return {
      ok: false,
      motivo: params.rol === 'admin' ? 'Ya es admin.' : 'Esa persona no es admin.',
    };
  }

  if (params.rol === 'member') {
    if (params.aQuien !== params.quien) {
      return { ok: false, motivo: 'No podés quitarle el admin a otra persona. Solo ella puede dejarlo.' };
    }
    const otrosAdmins = params.miembros.filter(
      (uno) => uno.role === 'admin' && uno.userId !== params.quien
    );
    if (otrosAdmins.length === 0) {
      return { ok: false, motivo: 'Sos el único admin. Nombrá a otro antes de dejar de serlo.' };
    }
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
