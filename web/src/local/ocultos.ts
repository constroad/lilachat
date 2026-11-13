import type { BaseLocal } from './baseLocal';

/**
 * «Eliminar para mí» (W2): el mensaje se oculta en este navegador al instante,
 * y desde el 13/11 el server guarda la lista para mis otros dispositivos. Vive en `meta` como la lista de `seq` de
 * cada chat; cerrar sesión lo borra junto con la base.
 */
const clave = (chatId: string) => `ocultos:${chatId}`;

export async function ocultosDe(base: BaseLocal, chatId: string): Promise<Set<number>> {
  const fila = await base.meta.get(clave(chatId));
  return new Set(Array.isArray(fila?.valor) ? (fila.valor as number[]) : []);
}

export async function ocultar(base: BaseLocal, chatId: string, seq: number): Promise<void> {
  await hideManyLocally(base, chatId, [seq]);
}

/** What this or another device of mine hid (the server keeps it since 13/11), merged without repeats. */
export async function hideManyLocally(base: BaseLocal, chatId: string, seqs: readonly number[]): Promise<void> {
  if (!seqs.length) return;
  await base.transaction('rw', base.meta, async () => {
    const current = await ocultosDe(base, chatId);
    const before = current.size;
    for (const seq of seqs) current.add(seq);
    if (current.size !== before) await base.meta.put({ clave: clave(chatId), valor: [...current] });
  });
}
