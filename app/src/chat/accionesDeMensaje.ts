/**
 * Qué se puede hacer con un mensaje en la pulsación larga (FL9). Motor PURO.
 *
 * Antes solo había «Eliminar», sin confirmar, y aparecía en mensajes ajenos
 * (que el server rechazaba). Ahora, como WhatsApp: responder, copiar,
 * reenviar, y eliminar «para todos» (solo lo propio) o «para mí».
 */
export type AccionesDeMensaje = {
  responder: boolean;
  copiar: boolean;
  reenviar: boolean;
  editar: boolean;
  /** «Info» (FL9): quién lo leyó y a quién le llegó. Solo de lo propio. */
  info: boolean;
  eliminarParaTodos: boolean;
  eliminarParaMi: boolean;
};

export function accionesDeMensaje(params: {
  mio: boolean;
  eliminado: boolean;
  /** Tiene texto (el mensaje o el pie de una foto). */
  conTexto: boolean;
  esMedia: boolean;
  /** En un chat secreto no se reenvía: llegaría en claro a otro chat. */
  chatSecreto: boolean;
  /** Lo decide `shared/puedeEditar` (propio, texto, < 15 min, no secreto). */
  editable: boolean;
}): AccionesDeMensaje {
  if (params.eliminado) {
    return { responder: false, copiar: false, reenviar: false, editar: false, info: false, eliminarParaTodos: false, eliminarParaMi: true };
  }
  return {
    responder: true,
    copiar: params.conTexto,
    // Se reenvía el TEXTO; reenviar una foto pide que el server la comparta.
    reenviar: params.conTexto && !params.esMedia && !params.chatSecreto,
    editar: params.editable,
    info: params.mio,
    eliminarParaTodos: params.mio,
    eliminarParaMi: true,
  };
}

const NINGUNA: AccionesDeMensaje = {
  responder: false,
  copiar: false,
  reenviar: false,
  editar: false,
  info: false,
  eliminarParaTodos: false,
  eliminarParaMi: false,
};

/**
 * Las acciones con VARIOS mensajes elegidos (FL9), como WhatsApp: responder,
 * editar e «Info» son de uno solo; copiar, reenviar y eliminar «para todos» valen si
 * valen para cada uno. «Para mí» siempre.
 */
export function accionesDeVarios(lista: readonly AccionesDeMensaje[]): AccionesDeMensaje {
  if (lista.length === 0) return NINGUNA;
  if (lista.length === 1) return lista[0] as AccionesDeMensaje;
  return {
    responder: false,
    editar: false,
    info: false,
    copiar: lista.every((uno) => uno.copiar),
    reenviar: lista.every((uno) => uno.reenviar),
    eliminarParaTodos: lista.every((uno) => uno.eliminarParaTodos),
    eliminarParaMi: true,
  };
}

/** El texto de varios mensajes para copiar: en el orden de la conversación. */
export function textoParaCopiar(mensajes: readonly { seq: number; body?: string }[]): string {
  return [...mensajes]
    .sort((a, b) => a.seq - b.seq)
    .map((mensaje) => mensaje.body?.trim() ?? '')
    .filter(Boolean)
    .join('\n');
}
