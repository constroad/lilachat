/**
 * «Escribiendo…» que no se apaga mientras se escribe (auditoría 19/10). Quien
 * escribe mandaba `on:true` UNA vez por ráfaga; quien mira lo apaga solo a los
 * pocos segundos (por si el `on:false` se pierde), así que en un párrafo largo
 * el cartel desaparecía con la persona todavía escribiendo. Ahora se repite
 * cada `REPETIR_ESCRIBIENDO_MS`, por debajo del apagado del que mira.
 */
export const REPETIR_ESCRIBIENDO_MS = 3000;
/** Quien mira apaga el cartel si no se renovó en este tiempo. */
export const APAGADO_DE_ESCRIBIENDO_MS = 6000;

/** ¿Mandar `on:true` con esta tecla? Sí si estaba apagado o si ya toca renovarlo. */
export function debeAvisarEscribiendo(params: { ultimoAviso: number | null; ahora: number }): boolean {
  return params.ultimoAviso === null || params.ahora - params.ultimoAviso >= REPETIR_ESCRIBIENDO_MS;
}
