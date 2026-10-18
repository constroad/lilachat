/** Una nota de voz no necesita más barras que esto para dibujarse. */
const MAXIMO_DE_BARRAS = 64;

/**
 * La onda de una nota de voz (FL9), como la manda la app: «12,40,…», barras de
 * 0 a 100. Se acota cada una y se descarta lo que no es un número; sin nada
 * usable, `undefined` y la nota se dibuja con la línea de siempre.
 */
export function ondaValida(texto: unknown): number[] | undefined {
  if (typeof texto !== 'string' || !texto.trim()) return undefined;
  const barras = texto
    .split(',')
    .slice(0, MAXIMO_DE_BARRAS)
    .map((parte) => Number(parte))
    .filter((numero) => Number.isFinite(numero))
    .map((numero) => Math.min(100, Math.max(0, Math.round(numero))));
  return barras.length > 0 ? barras : undefined;
}
