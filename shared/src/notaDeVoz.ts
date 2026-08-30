/**
 * Notas de voz: cuánto duró y si vale la pena mandarla. PURO.
 *
 * José, 30/08/2026: «que pueda enviar audios». El micrófono estaba en la barra
 * desde el primer día **apagado**, ocupando su lugar para que la barra no
 * cambiara de forma el día que existiera. Hoy existe.
 */

/**
 * Lo mínimo para que una grabación se mande.
 *
 * Un toque sin querer no puede dejar un audio de dos décimas en la conversación
 * de todos — y en un grupo eso le suena a cada teléfono. Medio segundo alcanza
 * para distinguir un roce de un «ya voy».
 */
export const MINIMO_DE_VOZ_MS = 500;

export function esVozUsable(duracionMs: number): boolean {
  return duracionMs >= MINIMO_DE_VOZ_MS;
}

/**
 * `m:ss`, truncando.
 *
 * Se trunca y no se redondea: un contador que salta a «0:01» sin haber pasado un
 * segundo se ve adelantado respecto de lo que se escucha, y en una nota de voz
 * el número y el audio se miran juntos.
 */
export function duracionDeVoz(ms?: number): string {
  const total = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${String(segundos).padStart(2, '0')}`;
}
