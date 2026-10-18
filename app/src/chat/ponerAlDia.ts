/**
 * Cuándo ofrecer «Ponme al día» de Lila. PURO.
 *
 * José, 18/10: salió con «1 mensaje sin leer», que se lee de un vistazo, y las
 * líneas de llamada contaban como mensajes (auditoría §46.3). Se ofrece con 10
 * o más mensajes ajenos de verdad entre los no leídos: ni avisos ni llamadas
 * (`system`), ni lo propio, ni lo eliminado.
 */
export const UMBRAL_PONER_AL_DIA = 10;

export function cuantosParaPonerAlDia(
  mensajes: readonly { senderId: string; kind?: string; deletedAt?: string }[],
  noLeidos: number,
  yo: string
): number {
  if (noLeidos <= 0) return 0;
  return mensajes
    .slice(-noLeidos)
    .filter((mensaje) => mensaje.kind !== 'system' && mensaje.senderId !== yo && !mensaje.deletedAt).length;
}

/**
 * Si se ofrece. «Y no se fue al leerlo» (José, 18/10): quien bajó hasta el
 * final ya leyó; un resumen de lo que acaba de leer no tiene sentido.
 */
export function ofrecerPonerAlDia(cuantos: number, yaLeyo: boolean): boolean {
  return cuantos >= UMBRAL_PONER_AL_DIA && !yaLeyo;
}
