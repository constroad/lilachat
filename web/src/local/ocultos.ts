import type { BaseLocal } from './baseLocal';

/**
 * «Eliminar para mí» (W2), como en la app: el mensaje se oculta en ESTE
 * navegador y en ningún otro lado. Vive en `meta` como la lista de `seq` de
 * cada chat; cerrar sesión lo borra junto con la base.
 */
const clave = (chatId: string) => `ocultos:${chatId}`;

export async function ocultosDe(base: BaseLocal, chatId: string): Promise<Set<number>> {
  const fila = await base.meta.get(clave(chatId));
  return new Set(Array.isArray(fila?.valor) ? (fila.valor as number[]) : []);
}

export async function ocultar(base: BaseLocal, chatId: string, seq: number): Promise<void> {
  await base.transaction('rw', base.meta, async () => {
    const actuales = await ocultosDe(base, chatId);
    actuales.add(seq);
    await base.meta.put({ clave: clave(chatId), valor: [...actuales] });
  });
}
