/**
 * La máquina de estados de una llamada (F10).
 *
 * WebRTC se ocupa del audio y el video; de CUÁNDO está sonando, cuándo se
 * conectó y qué pasó al final se ocupa esto — sin red y con test, porque es
 * donde más se nota un estado mal resuelto: un teléfono que sigue sonando
 * después de colgar, dos personas que se creen conectadas mientras el audio no
 * fluye, o una llamada perdida que nunca aparece en el chat.
 */

/** Cuánto suena antes de rendirse. Treinta segundos es lo que hace todo el mundo. */
export const CALL_TIMEOUT_MS = 30_000;
/**
 * Once the other side said «answering» (backlog 114), how long the media has to
 * arrive: unlocking the phone, starting the app and opening mic and camera.
 */
export const CALL_CONNECT_TIMEOUT_MS = 45_000;

/**
 * Lo que un teléfono declara al registrar su push (FL8.1): sabe dibujar la
 * llamada entrante a pantalla completa desde su servicio nativo. A ese le llega
 * la llamada como push SOLO-DATOS; a una versión vieja, la notificación común
 * de siempre (la nueva le llegaría muda).
 */
export const CAPACIDAD_LLAMADA_NATIVA = 'llamada-nativa';
/**
 * Sabe dibujar el aviso de un MENSAJE desde su servicio nativo y confirmar la
 * entrega sin abrir la app (FL8.2): es lo que pone el doble check gris.
 */
export const CAPACIDAD_MENSAJE_NATIVO = 'mensaje-nativo';
export const CAPACIDADES_DE_PUSH: readonly string[] = [CAPACIDAD_LLAMADA_NATIVA, CAPACIDAD_MENSAJE_NATIVO];
/** A phone that draws a reminder full screen (pending 63): it gets the reminder as a data push. */
export const REMINDER_NATIVE_CAPABILITY = 'recordatorio-nativo';
/** Every capability a phone may declare when it registers its push token. */
export const PUSH_CAPABILITIES: readonly string[] = [...CAPACIDADES_DE_PUSH, REMINDER_NATIVE_CAPABILITY];

export type CallState =
  /** `answeringAt`: the callee tapped «Contestar» and its media is on the way (backlog 114). */
  | { fase: 'llamando'; desde: number; entrante: false; answeringAt?: number }
  | { fase: 'sonando'; desde: number; entrante: true; answeringAt?: number }
  | { fase: 'activa'; desde: number; entrante: boolean; conectadaEn: number }
  | {
      fase: 'terminada';
      desde: number;
      entrante: boolean;
      /** `null` si nunca se conectó: de acá sale si fue perdida. */
      conectadaEn: number | null;
      terminadaEn: number;
      motivo: 'colgada' | 'rechazada' | 'sin-respuesta' | 'desconectada' | 'ocupado';
      porMi: boolean;
    };

export type CallEvent =
  | { tipo: 'contestada'; at: number }
  | { tipo: 'answering'; at: number }
  | { tipo: 'colgada'; at: number; porMi: boolean }
  | { tipo: 'rechazada'; at: number }
  | { tipo: 'tiempo'; at: number }
  | { tipo: 'desconectada'; at: number }
  | { tipo: 'ocupado'; at: number };

const terminar = (
  estado: CallState,
  at: number,
  motivo: Extract<CallState, { fase: 'terminada' }>['motivo'],
  porMi: boolean
): CallState => ({
  fase: 'terminada',
  desde: estado.desde,
  entrante: estado.entrante,
  conectadaEn: estado.fase === 'activa' ? estado.conectadaEn : null,
  terminadaEn: at,
  motivo,
  porMi,
});

/** When an unanswered call gives up: the ring, or the connect window once answering. `null` once answered or ended. */
export function ringDeadline(state: CallState): number | null {
  if (state.fase !== 'llamando' && state.fase !== 'sonando') return null;
  return state.answeringAt === undefined ? state.desde + CALL_TIMEOUT_MS : state.answeringAt + CALL_CONNECT_TIMEOUT_MS;
}

export function nextCallState(estado: CallState, evento: CallEvent): CallState {
  // UNA LLAMADA TERMINADA NO VUELVE. Un evento tardío —el «colgó» del otro que
  // llega después de que yo colgué— reabriría la pantalla de llamada sola.
  if (estado.fase === 'terminada') return estado;

  switch (evento.tipo) {
    case 'contestada':
      return estado.fase === 'activa'
        ? estado
        : { fase: 'activa', desde: estado.desde, entrante: estado.entrante, conectadaEn: evento.at };

    // The first one counts: the window is measured from the tap.
    case 'answering':
      return estado.fase === 'activa' || estado.answeringAt !== undefined ? estado : { ...estado, answeringAt: evento.at };

    case 'colgada':
      return terminar(estado, evento.at, 'colgada', evento.porMi);

    // Rechazar una ENTRANTE y colgar una activa no son lo mismo: la primera es
    // una perdida que tiene que aparecer en el chat.
    case 'rechazada':
      return terminar(estado, evento.at, 'rechazada', true);

    case 'ocupado':
      return terminar(estado, evento.at, 'ocupado', false);

    case 'desconectada':
      return terminar(estado, evento.at, 'desconectada', false);

    // El tiempo solo mata lo que NUNCA se conectó: una llamada activa puede
    // durar horas.
    // A timer set before «answering» (or one that fires a hair early) does not count.
    case 'tiempo': {
      const deadline = ringDeadline(estado);
      return deadline === null || evento.at < deadline ? estado : terminar(estado, evento.at, 'sin-respuesta', false);
    }
  }
}

const dosDigitos = (valor: number): string => String(valor).padStart(2, '0');

/**
 * El reloj de la llamada.
 *
 * Cuenta desde que se CONECTÓ, no desde que empezó a sonar: los treinta
 * segundos que estuvo timbrando no son parte de la conversación, y contarlos
 * haría que el registro mienta sobre cuánto habló la gente.
 */
export function formatCallDuration(estado: CallState, now: number): string {
  const inicio =
    estado.fase === 'activa'
      ? estado.conectadaEn
      : estado.fase === 'terminada'
        ? estado.conectadaEn
        : null;
  if (inicio === null) return '';

  const fin = estado.fase === 'terminada' ? estado.terminadaEn : now;
  const total = Math.max(0, Math.floor((fin - inicio) / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;

  return horas > 0
    ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`
    : `${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
}

/**
 * La línea que queda en el chat cuando la llamada termina.
 *
 * **Perdida = nunca se conectó.** No importa quién colgó: si no llegaron a
 * hablar, para el que no contestó es una llamada perdida y tiene que verla.
 */
export function summarizeEndedCall(estado: CallState): { perdida: boolean; duracion: string } {
  if (estado.fase !== 'terminada') return { perdida: false, duracion: '' };

  return {
    perdida: estado.conectadaEn === null,
    duracion: formatCallDuration(estado, estado.terminadaEn),
  };
}
