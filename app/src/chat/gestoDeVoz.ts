/**
 * El gesto del micrófono (FL9; auditoría §46.2). PURO.
 *
 * Como WhatsApp: sostener y soltar manda, deslizar a la izquierda cancela,
 * hacia arriba bloquea (sigue grabando sin el dedo). Y un toque corto sigue
 * siendo «grabar sin manos», como andaba antes: para quien no tiene incorporado
 * sostener, soltar sin querer no tiene que mandar un audio cortado.
 */
/** Cuánto hay que deslizar a la izquierda para cancelar (dp). */
export const UMBRAL_CANCELAR = 100;
/** Cuánto hay que deslizar hacia arriba para bloquear (dp). */
export const UMBRAL_BLOQUEO = 80;
/** Menos que esto es un toque, no un «sostener» (ms). */
export const TOQUE_CORTO_MS = 400;

export type DecisionDeVoz = 'enviar' | 'cancelar' | 'bloquear';

export function decidirAlSoltar(gesto: { dx: number; dy: number; ms: number }): DecisionDeVoz {
  if (gesto.dx < -UMBRAL_CANCELAR) return 'cancelar';
  if (gesto.dy < -UMBRAL_BLOQUEO) return 'bloquear';
  if (gesto.ms < TOQUE_CORTO_MS) return 'bloquear';
  return 'enviar';
}

/** Qué pasaría si se soltara ahora: lo que la barra le avisa a quien graba. */
export function mientrasSostiene(gesto: { dx: number; dy: number }): 'normal' | 'cancelaria' | 'bloquearia' {
  if (gesto.dx < -UMBRAL_CANCELAR) return 'cancelaria';
  if (gesto.dy < -UMBRAL_BLOQUEO) return 'bloquearia';
  return 'normal';
}
