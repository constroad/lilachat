/**
 * Recorre `elementos` en lotes de `tamano`, cediendo el hilo ENTRE lotes (FL5,
 * spec §45). Es la forma de hacer trabajo largo en el hilo de JS —cifrar o
 * importar miles de mensajes— sin congelar la pantalla.
 *
 * Suma lo que devuelve cada lote (p. ej. filas escritas de verdad). Un error en
 * un lote corta y se propaga: quien llama decide, no se sigue a medias.
 */
export async function porLotes<T>(
  elementos: readonly T[],
  tamano: number,
  tarea: (lote: readonly T[]) => Promise<number | void>,
  ceder: () => Promise<void>
): Promise<number> {
  const paso = Math.max(1, Math.floor(tamano) || 1);
  let total = 0;
  for (let desde = 0; desde < elementos.length; desde += paso) {
    if (desde > 0) await ceder();
    total += (await tarea(elementos.slice(desde, desde + paso))) ?? 0;
  }
  return total;
}
