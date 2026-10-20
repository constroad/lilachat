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
  /** Fijar arriba del chat (19/10): `null` si no se puede (permiso, borrado o varios). */
  fijar: 'fijar' | 'desfijar' | null;
  /** «Responder en hilo» (E3, 20/10): de uno, vivo, no secreto, no aviso ni ya respuesta de un hilo. */
  hilo: boolean;
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
  /** Lo decide `puedeFijarEnElChat` (en un grupo, solo admins). */
  puedeFijar?: boolean;
  /** Ya está fijado: la acción es desfijar. */
  fijado?: boolean;
  /** Ya es la respuesta de un hilo: no hay hilos de hilos (E3). */
  esRespuestaDeHilo?: boolean;
}): AccionesDeMensaje {
  if (params.eliminado) {
    return { responder: false, copiar: false, reenviar: false, editar: false, info: false, eliminarParaTodos: false, eliminarParaMi: true, fijar: null, hilo: false };
  }
  return {
    responder: true,
    copiar: params.conTexto,
    // El texto viaja como texto; una foto o un archivo, por referencia (el
    // server comparte el archivo, auditoría 19/10). Desde un secreto, no.
    reenviar: (params.conTexto || params.esMedia) && !params.chatSecreto,
    editar: params.editable,
    info: params.mio,
    eliminarParaTodos: params.mio,
    eliminarParaMi: true,
    fijar: params.puedeFijar ? (params.fijado ? 'desfijar' : 'fijar') : null,
    hilo: !params.chatSecreto && !params.esRespuestaDeHilo,
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
  fijar: null,
  hilo: false,
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
    // Se fija de a uno, como WhatsApp; el hilo también.
    fijar: null,
    hilo: false,
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

export type PasoDeReenvio = { tipo: 'texto'; texto: string } | { tipo: 'mensaje'; chatId: string; seq: number };

/**
 * Qué se manda al reenviar varios mensajes, en orden (auditoría 19/10): el
 * texto como texto; una foto o un archivo, por referencia —el server copia el
 * archivo y su pie (`POST /api/chats/:id/reenviar`)—. Lo vacío no sale.
 */
export function planDeReenvio(mensajes: readonly { chatId: string; seq: number; body?: string; media?: unknown }[]): PasoDeReenvio[] {
  return [...mensajes]
    .sort((a, b) => a.seq - b.seq)
    .flatMap((mensaje): PasoDeReenvio[] => {
      if (mensaje.media) return [{ tipo: 'mensaje', chatId: mensaje.chatId, seq: mensaje.seq }];
      const texto = mensaje.body?.trim();
      return texto ? [{ tipo: 'texto', texto }] : [];
    });
}

