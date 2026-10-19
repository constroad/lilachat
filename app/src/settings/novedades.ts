/** Lo nuevo de una versión, tal como lo publica LilaStore (`--notes`). */
export type Novedad = { version: string; versionCode: number; notas: string };

/**
 * Las novedades que devolvió `min-version?desde=` (LilaStore, 19/10), de la más
 * nueva a la más vieja. Lo que no tiene forma se descarta; un server que no las
 * manda da ninguna, y la banda baja directo como siempre.
 */
export function leerNovedades(crudo: unknown): Novedad[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter(
      (n): n is Novedad =>
        typeof n?.version === 'string' && typeof n?.versionCode === 'number' && typeof n?.notas === 'string' && n.notas.trim() !== ''
    )
    .map(({ version, versionCode, notas }) => ({ version, versionCode, notas: notas.trim() }))
    .sort((a, b) => b.versionCode - a.versionCode);
}

/** Una línea por novedad, sin viñetas («•», «-», «*») ni líneas vacías. */
export function lineasDeNotas(notas: string): string[] {
  return notas
    .split('\n')
    .map((linea) => linea.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean);
}
