import type { Cursors } from '@lilachat/shared';
import type { BaseLocal } from '../local/baseLocal';
import { cursoresLocales } from '../local/mensajesLocales';
import type { ChatMessage } from '../chat/types';

export type LoteDeSincronizacion = { chatId: string; messages: ChatMessage[] };

/**
 * Ponerse al día al reconectar (W1), por CURSOR: se manda hasta qué `seq`
 * tengo de cada chat y el server contesta solo lo que falta (`sync.pull`).
 *
 * Sin nada guardado no se pide: con cursores vacíos el server recorre TODOS
 * los chats desde el principio. Esos chats se llenan al abrirlos (página del
 * historial), no por acá.
 */
export async function sincronizar(params: {
  base: BaseLocal;
  pedir: (cursores: Cursors) => Promise<LoteDeSincronizacion[] | null>;
}): Promise<{ recibidos: number } | null> {
  const { base } = params;
  const cursores = await cursoresLocales(base);
  if (Object.keys(cursores).length === 0) return { recibidos: 0 };
  const lotes = await params.pedir(cursores);
  if (!lotes) return null;
  const mensajes = lotes.flatMap((lote) => lote.messages);
  await base.transaction('rw', base.mensajes, base.cola, async () => {
    await base.mensajes.bulkPut(mensajes);
    await base.cola.bulkDelete(mensajes.map((uno) => uno.clientKey).filter(Boolean));
  });
  return { recibidos: mensajes.length };
}
