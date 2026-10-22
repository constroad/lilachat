import { callCaption, mediaState, waitBeforeGivingUp, type CallState } from '@lilachat/shared';

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
  // The engine lives in shared since the web makes calls too (`callMedia.ts`).
  return mediaState(ice, yaConecto);
}

/**
 * Cuánto se espera a que el audio pase (o vuelva) antes de cortar. ICE solo
 * llega a `failed` si probó candidatos del otro lado; si no le llegó ninguno se
 * queda en «conectando» para siempre — en el E2E fueron 80 s hasta colgar a mano.
 */
export const ESPERA_DE_CONEXION_MS = 30_000;

export function esperaAntesDeRendirse(medios: EstadoDeMedios): number | null {
  return waitBeforeGivingUp(medios);
}

/** La línea bajo el nombre en la pantalla de llamada. */
export function leyendaDeLlamada(params: {
  state: CallState;
  medios: EstadoDeMedios;
  video: boolean;
  ahora: number;
}): string {
  return callCaption({ state: params.state, media: params.medios, video: params.video, now: params.ahora });
}
