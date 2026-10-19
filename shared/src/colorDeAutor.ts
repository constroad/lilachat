/** Cuántos colores de autor hay en la paleta (`autor-1` … `autor-6`). */
export const CANTIDAD_DE_COLORES_DE_AUTOR = 6;

/**
 * El color de una persona en un grupo: estable (sale de su id, no del orden de
 * llegada), así Mamá es siempre rosa en todos los chats, en el teléfono y en
 * la web. Salió de `app/src/chat/burbuja.ts` (W2, 19/10).
 */
export function colorDeAutor(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return (hash % CANTIDAD_DE_COLORES_DE_AUTOR) + 1;
}
