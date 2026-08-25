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

export type CallState =
  | { fase: 'llamando'; desde: number; entrante: false }
  | { fase: 'sonando'; desde: number; entrante: true }
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

export function nextCallState(estado: CallState, evento: CallEvent): CallState {
  // UNA LLAMADA TERMINADA NO VUELVE. Un evento tardío —el «colgó» del otro que
  // llega después de que yo colgué— reabriría la pantalla de llamada sola.
  if (estado.fase === 'terminada') return estado;

  switch (evento.tipo) {
    case 'contestada':
      return estado.fase === 'activa'
        ? estado
        : { fase: 'activa', desde: estado.desde, entrante: estado.entrante, conectadaEn: evento.at };

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
    case 'tiempo':
      return estado.fase === 'activa' ? estado : terminar(estado, evento.at, 'sin-respuesta', false);
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
