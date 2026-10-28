import { ringStart, type CallState } from '@lilachat/shared';
import type { AccionDeAviso, LockScreenAnswer } from '../../modules/llamada-entrante/src';

/**
 * Lo puro de la llamada entrante nativa (FL8.1). Motor sin `react-native`.
 */
export type QueHacer = 'contestar' | 'colgar' | 'esperar' | 'nada';

/**
 * Qué hacer con lo que se tocó en la notificación de llamada.
 *
 * La app puede abrir EN FRÍO desde la notificación: el toque llega antes que
 * la oferta (que viene por el socket al conectar). Ese caso «espera»: cuando
 * llegue la oferta de ese chat se vuelve a decidir.
 */
export function queHacerConElAviso(params: {
  aviso: AccionDeAviso;
  estado: CallState | null;
  chatId: string | null;
}): QueHacer {
  const { aviso, estado } = params;
  // Tocar el aviso de un MENSAJE (FL8.2) lo atiende la navegación, no la llamada.
  if (aviso.accion === 'chat') return 'nada';
  // «Colgar» viene de la notificación de la llamada EN CURSO (FL11): no se espera ninguna oferta.
  if (aviso.accion === 'colgar') return estado && estado.fase !== 'terminada' && params.chatId === aviso.chatId ? 'colgar' : 'nada';
  if (!estado || estado.fase === 'terminada') return aviso.accion === 'rechazar' ? 'nada' : 'esperar';
  if (params.chatId !== aviso.chatId || estado.fase !== 'sonando') return 'nada';
  if (aviso.accion === 'contestar') return 'contestar';
  if (aviso.accion === 'rechazar') return 'colgar';
  return 'nada';
}

/**
 * Si hace falta el servicio «Llamada en curso» (FL11). Sin él, Android congela
 * la app de fondo y el audio se corta hasta volver. Va con la llamada activa y
 * llamando hacia afuera; una entrante que suena tiene su propia notificación.
 */
export function necesitaServicioDeLlamada(estado: CallState | null): boolean {
  return estado?.fase === 'activa' || estado?.fase === 'llamando';
}

/** El «tuu… tuu» de quien llama, hasta que contestan (20/10). */
// Or until the other side says «answering» (backlog 114).
export function suenaTonoDeLlamando(estado: CallState | null): boolean {
  return estado?.fase === 'llamando' && estado.answeringAt === undefined;
}

/**
 * Backlog 114: «Contestar» on the lock screen with the app alive behind it. The
 * native side already said it by HTTP; with this call ringing here, the socket
 * says it faster.
 */
export function announcesAnswering(params: { tap: LockScreenAnswer; state: CallState | null; callChatId: string | null }): boolean {
  return params.state?.fase === 'sonando' && params.callChatId === params.tap.chatId;
}

/** Con la app adelante suena el tono; de fondo, la notificación nativa. */
export function comoSuena(params: { sonandoEntrante: boolean; appActiva: boolean }): 'tono' | 'aviso-nativo' | 'nada' {
  if (!params.sonandoEntrante) return 'nada';
  return params.appActiva ? 'tono' : 'aviso-nativo';
}

/** Cuánto hay que subir el botón verde para contestar (dp). */
export const UMBRAL_DE_DESLIZAR = 110;
/** Un tirón: rápido hacia arriba (dp/s) y con un mínimo de recorrido. */
const VELOCIDAD_DE_TIRON = -900;
const RECORRIDO_MINIMO_DEL_TIRON = -40;

export function decidirDeslizamiento(params: { dy: number; vy: number }): 'contestar' | 'volver' {
  // Corre en el hilo de UI, dentro del gesto (FL8.1): sin esto el gesto falla.
  'worklet';
  if (params.dy <= -UMBRAL_DE_DESLIZAR) return 'contestar';
  if (params.vy <= VELOCIDAD_DE_TIRON && params.dy <= RECORRIDO_MINIMO_DEL_TIRON) return 'contestar';
  return 'volver';
}

/**
 * Cuándo empezó a sonar una oferta, desde lo que le QUEDA según el server. Una
 * oferta entregada tarde (al conectar desde la notificación) no arranca otros
 * 30 s: el server ya la daría por perdida mientras se contesta.
 */
export function inicioDelTimbre(quedaMs: number | undefined, ahora: number): number {
  return ringStart(quedaMs, ahora);
}
