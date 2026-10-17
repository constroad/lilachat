/**
 * Quién puede editar qué (pedido de José, 17/10/2026). Motor PURO, compartido
 * por el server —que es quien decide— y la app, que solo ofrece «Editar»
 * cuando corresponde.
 *
 * Como WhatsApp: solo lo propio, solo texto y durante 15 minutos. Pasado ese
 * rato, editar cambiaría lo que el otro ya leyó y contestó.
 */
export const VENTANA_DE_EDICION_MS = 15 * 60 * 1000;

export type DecisionDeEdicion = { permitido: true } | { permitido: false; motivo: string };

export function puedeEditar(params: {
  yo: string;
  autor: string;
  kind: string;
  eliminado: boolean;
  /** En un chat secreto el texto viaja cifrado: editar pide cifrar de nuevo. */
  secreto: boolean;
  enviadoEn: number | string | Date;
  ahora: number;
}): DecisionDeEdicion {
  if (params.autor !== params.yo) return { permitido: false, motivo: 'Solo puedes editar tus propios mensajes.' };
  if (params.eliminado) return { permitido: false, motivo: 'Ese mensaje ya no existe.' };
  if (params.kind !== 'text') return { permitido: false, motivo: 'Solo se editan los mensajes de texto.' };
  if (params.secreto) return { permitido: false, motivo: 'En un chat secreto todavía no se puede editar.' };
  const enviado = new Date(params.enviadoEn).getTime();
  if (!Number.isFinite(enviado) || params.ahora - enviado > VENTANA_DE_EDICION_MS) {
    return { permitido: false, motivo: 'Pasaron más de 15 minutos: ya no se puede editar.' };
  }
  return { permitido: true };
}
