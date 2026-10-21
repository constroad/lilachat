import { actsAsMessage } from './avisoDeGrupo.js';
import { formatClock } from './chatDisplay.js';

/**
 * Hilos (E3, 20/10). Una respuesta es un mensaje más del chat con `hiloDe`
 * (el `seq` de su raíz); la raíz trae el resumen que guarda el server. Motor
 * PURO para la app y la web.
 */
export type ResumenDeHiloEnCliente = { respuestas: number; ultimaEn?: string; ultimaSeq?: number; autores?: readonly string[] };

/** El chat principal no muestra las respuestas de un hilo, salvo «También enviar al chat». */
export function visibleEnElChat(mensaje: { hiloDe?: number; enElChat?: boolean }): boolean {
  return mensaje.hiloDe === undefined || mensaje.enElChat === true;
}

/**
 * ¿Se abre un hilo desde este mensaje? Confirmado, vivo, no un aviso ni ya
 * respuesta de otro hilo, y fuera de un chat secreto (las mismas reglas que el
 * server en `validarRaiz`). Una tarjeta de recordatorio, evento o encuesta
 * también (José, 20/10).
 */
export function canOpenThread(message: { seq: number | null; kind?: string; system?: { evento?: string } | null; hiloDe?: number; deletedAt?: string | null; cifrado?: boolean }): boolean {
  return message.seq !== null && actsAsMessage(message) && message.hiloDe === undefined && !message.deletedAt && !message.cifrado;
}

/** «1 respuesta · 11:05» o «4 respuestas · última 10:42». Sin respuestas, nada. */
export function textoDelChipDeHilo(hilo: ResumenDeHiloEnCliente): string {
  if (hilo.respuestas <= 0) return '';
  const hora = hilo.ultimaEn ? formatClock(hilo.ultimaEn) : '';
  if (hilo.respuestas === 1) return hora ? `1 respuesta · ${hora}` : '1 respuesta';
  return hora ? `${hilo.respuestas} respuestas · última ${hora}` : `${hilo.respuestas} respuestas`;
}

/** Hay respuestas que no vi (la última es posterior a lo visto y no la escribí yo). */
export function hayRespuestasNuevas(hilo: ResumenDeHiloEnCliente, vistoHasta: number | undefined, yo: string): boolean {
  if (hilo.respuestas <= 0 || !hilo.ultimaSeq) return false;
  if (hilo.autores?.[hilo.autores.length - 1] === yo) return false;
  return hilo.ultimaSeq > (vistoHasta ?? 0);
}

/** Las respuestas de una raíz que hay en memoria, en orden. */
export function respuestasDelHilo<M extends { seq: number; hiloDe?: number }>(mensajes: readonly M[], raiz: number): M[] {
  return mensajes.filter((mensaje) => mensaje.hiloDe === raiz).sort((a, b) => a.seq - b.seq);
}

/** El resumen nuevo (evento `msg.hilo` o `GET /hilos`) en su raíz. Sin la raíz, la misma lista. */
export function aplicarResumenDeHilo<M extends { seq: number; hilo?: ResumenDeHiloEnCliente }>(mensajes: M[], raiz: number, hilo: ResumenDeHiloEnCliente): M[] {
  const indice = mensajes.findIndex((mensaje) => mensaje.seq === raiz);
  if (indice === -1) return mensajes;
  return mensajes.map((mensaje, i) => (i === indice ? { ...mensaje, hilo } : mensaje));
}
