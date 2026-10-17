import { CALL_TIMEOUT_MS } from '@lilachat/shared';
import { UserModel } from './models.js';

/**
 * Las ofertas de llamada que todavía están SONANDO (FL8).
 *
 * El server reenviaba `call.offer` a los sockets conectados en ese instante y
 * nada más: quien tenía la app en la lista, en otro chat o cerrada no se
 * enteraba (la escucha vivía en la pantalla del chat, y el socket pausado no
 * recibe nada). Ahora la oferta se guarda mientras suena (`CALL_TIMEOUT_MS`):
 * quien conecta en ese tiempo —por ejemplo, al tocar el push «Llamada de…»—
 * la recibe y puede contestar.
 *
 * En memoria a propósito: dura 30 s, y si el server se reinicia la llamada
 * muere igual (el socket del que llama también).
 */
type Pendiente = { frame: object; from: string; at: number };

const pendientes = new Map<string, Pendiente>();

export function guardarOferta(chatId: string, frame: object, from: string, ahora: number = Date.now()): void {
  pendientes.set(chatId, { frame, from, at: ahora });
}

/** Contestar, colgar, rechazar o «ocupado»: deja de sonar. */
export function limpiarOferta(chatId: string): void {
  pendientes.delete(chatId);
}

/** Las que siguen sonando en mis chats, sin las que hice yo. */
export function ofertasVigentes(chatIds: readonly string[], userId: string, ahora: number = Date.now()): object[] {
  const vigentes: object[] = [];
  for (const chatId of chatIds) {
    const pendiente = pendientes.get(chatId);
    if (!pendiente) continue;
    if (ahora - pendiente.at > CALL_TIMEOUT_MS) {
      pendientes.delete(chatId);
      continue;
    }
    if (pendiente.from !== userId) vigentes.push(pendiente.frame);
  }
  return vigentes;
}

/** ¿Hay alguna sonando? Evita una consulta por conexión cuando no hay ninguna. */
export function hayOfertasPendientes(): boolean {
  return pendientes.size > 0;
}

/**
 * La señal tal como se reenvía: con su autor y, en la OFERTA, con su nombre y
 * teléfono. La app arma el nombre de quien llama con el chat que tiene
 * cargado, y al abrir desde el push «Llamada de…» (o con un chat recién
 * creado) todavía no lo tiene: la pantalla decía «Llamada» en vez de la
 * persona (prueba real del 17/10/2026). Las otras señales no consultan la base.
 */
export async function frameConAutor(evento: string, payload: object, userId: string): Promise<object> {
  const frame = { ...payload, from: userId };
  if (evento !== 'call.offer') return frame;
  const autor = await UserModel.findById(userId).select('name phone').lean();
  return autor ? { ...frame, fromName: autor.name ?? null, fromPhone: autor.phone } : frame;
}

/** Solo para tests. */
export function __reiniciarLlamadas(): void {
  pendientes.clear();
}
