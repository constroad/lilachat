import { audienceOfNotes, isAudienceLine, type ReleaseAudience } from '@lilachat/shared';
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
    .filter((linea) => linea && !isAudienceLine(linea));
}

/** Who the published versions newer than this build are for (José, 24/10: personal vs. company mode). */
export function newerAudiences(novedades: readonly Novedad[], actual: number, ultima: number | null): ReleaseAudience[] {
  return novedades.filter((novedad) => novedad.versionCode > actual && (ultima === null || novedad.versionCode <= ultima)).map((novedad) => audienceOfNotes(novedad.notas));
}
