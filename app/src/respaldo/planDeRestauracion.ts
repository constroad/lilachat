import { bytesLegibles } from '@lilachat/shared';

/**
 * Restaurar en un teléfono nuevo (F12.2), lo PURO. Lo que toca la red y el
 * almacén vive en `restaurar.ts`.
 */

export type DecisionDeOferta = 'ofrecer' | 'nada';

/**
 * Se ofrece sola UNA vez, y solo con el almacén vacío: un teléfono con
 * historial no pisa lo que tiene por un respaldo viejo. Desde Ajustes se puede
 * restaurar a mano cuando se quiera.
 */
export function decidirOferta(entrada: { hayRespaldo: boolean; almacenVacio: boolean; yaOfrecido: boolean }): DecisionDeOferta {
  if (!entrada.hayRespaldo || !entrada.almacenVacio || entrada.yaOfrecido) return 'nada';
  return 'ofrecer';
}

/** «del 15/09/2026 · 1,2 MB» — la fecha en la zona de la persona, no en UTC. */
export function descripcionDeRespaldo(respaldo: { creadoEn: string; bytes: number }, zona: string): string {
  const fecha = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: zona }).format(
    new Date(respaldo.creadoEn)
  );
  return `del ${fecha} · ${bytesLegibles(respaldo.bytes)}`;
}

/** Lo bajado tiene que ser lo que el server anunció: un archivo truncado no se intenta abrir. */
export function verificarDescarga(entrada: { esperada: string; calculada: string }): boolean {
  return entrada.esperada.length > 0 && entrada.esperada === entrada.calculada;
}

/** Lo que se dice al terminar. `mensajes` = filas escritas de verdad (FL5). */
export function descripcionDeRestauracion(resultado: { chats: number; mensajes: number }): string {
  if (resultado.mensajes === 0) return 'Listo: el teléfono ya tenía todo lo del respaldo.';
  const chats = `${resultado.chats} ${resultado.chats === 1 ? 'chat' : 'chats'}`;
  const mensajes = `${resultado.mensajes} ${resultado.mensajes === 1 ? 'mensaje' : 'mensajes'}`;
  return `Listo: ${chats} y ${mensajes} de vuelta en el teléfono.`;
}
