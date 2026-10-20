/**
 * La fracción del anillo de una subida (auditoría 19/10). Acotada a 0–1: un
 * multipart puede reportar más que el total. Gira sin medida o al llegar al
 * final (el server procesa): un círculo lleno y quieto se lee como colgado.
 */
export function anilloDeSubidaWeb(razon?: number): { fraccion: number; girando: boolean } {
  if (typeof razon !== 'number' || !Number.isFinite(razon) || razon <= 0) return { fraccion: 0, girando: true };
  const fraccion = Math.min(1, razon);
  return { fraccion, girando: fraccion >= 1 };
}
