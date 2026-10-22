import { formatBytes } from '@lilachat/shared';
import { lineasDeNotas, type Novedad } from './novedades';

/** A reason to update, not the changelog. */
const MAX_NOTES = 5;

/**
 * What the screen that blocks a version under the minimum says (backlog 32;
 * design `u-01-actualizacion-obligatoria`). Pure. It says «ya no se puede
 * usar», the band's words: the server does not reject old versions yet, so
 * «ya no se conecta» would not be true.
 */
export function updateLockContent(params: { installed: string; latest: string; novedades: Novedad[]; size: number }): { body: string; notesTitle: string; notes: string[]; source: string } {
  const installed = params.installed ? ` (${params.installed})` : '';
  const newest = params.novedades[0];
  return {
    body: `Esta versión${installed} ya no se puede usar. La nueva es la ${params.latest}.`,
    notesTitle: `Novedades de la ${newest?.version ?? params.latest}`,
    notes: newest ? lineasDeNotas(newest.notas).slice(0, MAX_NOTES) : [],
    source: params.size > 0 ? `Se descarga desde LilaStore · ${formatBytes(params.size)}` : 'Se descarga desde LilaStore',
  };
}
