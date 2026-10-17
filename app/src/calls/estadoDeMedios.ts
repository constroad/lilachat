import { formatCallDuration, type CallState } from '@lilachat/shared';

/**
 * Si el audio está pasando, aparte de si la llamada fue contestada (FL8).
 *
 * La máquina de `shared/call.ts` sabe de la SEÑAL: sonó, la contestaron, colgó.
 * Que el audio pase lo decide ICE, que puede tardar unos segundos o no llegar
 * nunca (redes que no se ven). Antes el reloj corría desde «contestada» y en la
 * prueba real del 17/10/2026 José contestó y no escuchó nada sin que la
 * pantalla lo dijera. Motor puro: recibe el `iceConnectionState` como texto.
 */
export type EstadoDeMedios = 'conectando' | 'conectada' | 'reconectando' | 'fallo';

export function estadoDeMedios(ice: string, yaConecto: boolean): EstadoDeMedios {
  if (ice === 'connected' || ice === 'completed') return 'conectada';
  if (ice === 'failed') return 'fallo';
  // `closed` lo produce quien cuelga; no es una novedad de la red.
  if (ice === 'closed') return yaConecto ? 'conectada' : 'conectando';
  return yaConecto ? 'reconectando' : 'conectando';
}

/**
 * Cuánto se espera a que el audio pase (o vuelva) antes de cortar. ICE solo
 * llega a `failed` si probó candidatos del otro lado; si no le llegó ninguno se
 * queda en «conectando» para siempre — en el E2E fueron 80 s hasta colgar a mano.
 */
export const ESPERA_DE_CONEXION_MS = 30_000;

export function esperaAntesDeRendirse(medios: EstadoDeMedios): number | null {
  return medios === 'conectando' || medios === 'reconectando' ? ESPERA_DE_CONEXION_MS : null;
}

/** La línea bajo el nombre en la pantalla de llamada. */
export function leyendaDeLlamada(params: {
  state: CallState;
  medios: EstadoDeMedios;
  video: boolean;
  ahora: number;
}): string {
  const { state, medios } = params;
  if (state.fase === 'llamando') return 'Llamando…';
  if (state.fase === 'sonando') return params.video ? 'Videollamada entrante' : 'Llamada entrante';
  if (state.fase === 'terminada') return state.motivo === 'desconectada' ? 'No se pudo conectar' : 'Llamada terminada';
  if (medios === 'conectando') return 'Conectando…';
  if (medios === 'reconectando') return 'Reconectando…';
  return formatCallDuration(state, params.ahora);
}
