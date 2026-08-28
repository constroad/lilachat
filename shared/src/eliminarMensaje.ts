/**
 * Quién puede borrar qué. Motor PURO, compartido por el server y la app.
 *
 * José lo pidió tres veces: «no puedo seleccionar un mensaje para eliminación», y
 * «debe aparecerme el texto mensaje eliminado después de eliminar».
 *
 * Esa segunda mitad no es cosmética, es la decisión de diseño importante: al
 * borrar **queda una lápida**, no un hueco. Si el mensaje desapareciera sin
 * dejar rastro, la conversación del otro lado cambiaría de sentido sin que se
 * entere — respuestas colgando de algo que ya no está. WhatsApp y Telegram
 * dejan la lápida por lo mismo.
 */

/** Lo que se muestra en lugar del contenido borrado. */
export const TEXTO_ELIMINADO = 'Se eliminó este mensaje';

export type DecisionDeBorrado =
  | { permitido: true }
  /** `motivo` se le muestra a la persona: un «no» sin razón se lee como un bug. */
  | { permitido: false; motivo: string };

export function puedeEliminar(params: {
  /** Quién pide borrar. */
  yo: string;
  /** De quién es el mensaje. */
  autor: string;
  /** Si ya está borrado. */
  yaEliminado?: boolean;
}): DecisionDeBorrado {
  /**
   * **Solo el autor borra para todos.**
   *
   * Sin esta regla cualquiera podría vaciar la conversación de otro, y eso no es
   * un permiso que se pueda dar y revisar después: hay que negarlo en el server,
   * porque un cliente modificado se saltea cualquier validación de la app.
   */
  if (params.autor !== params.yo) {
    return { permitido: false, motivo: 'Solo podés eliminar tus propios mensajes.' };
  }

  // Volver a borrar lo ya borrado no es un error que valga la pena mostrar,
  // pero tampoco hay que rehacer el trabajo ni volver a avisar a todos.
  if (params.yaEliminado) {
    return { permitido: false, motivo: 'Ese mensaje ya estaba eliminado.' };
  }

  return { permitido: true };
}

/**
 * Qué queda guardado de un mensaje borrado.
 *
 * **Se vacía de verdad**: el texto, el sobre cifrado y el archivo se van de la
 * base. Un «eliminado» que solo pone una bandera y conserva el contenido es una
 * mentira — cualquiera con acceso a la base sigue leyéndolo, y el server ya
 * guarda las conversaciones en claro (§32 del as-is), así que la bandera sola no
 * protegería nada.
 *
 * Lo que SÍ se conserva: el `seq`, el autor y la fecha. Son lo que sostiene el
 * orden de la conversación y la sincronización por cursor; borrarlos dejaría
 * huecos en la numeración que los clientes leen como mensajes por descargar.
 */
export function camposDeLapida(ahora: string): {
  body: undefined;
  envelope: undefined;
  media: undefined;
  deletedAt: string;
} {
  return { body: undefined, envelope: undefined, media: undefined, deletedAt: ahora };
}
