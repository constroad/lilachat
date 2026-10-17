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
    return { responder: false, copiar: false, reenviar: false, editar: false, eliminarParaTodos: false, eliminarParaMi: true };
  }
  return {
    responder: true,
    copiar: params.conTexto,
    // Se reenvía el TEXTO; reenviar una foto pide que el server la comparta.
    reenviar: params.conTexto && !params.esMedia && !params.chatSecreto,
    editar: params.editable,
    eliminarParaTodos: params.mio,
    eliminarParaMi: true,
  };
}
