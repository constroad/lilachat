import { buildWorkStreetsKml, zipOneFile, type KmlParams } from '@constroad/shared/obra';
import { workMapCutLabel, type WorkMap, type WorkMapFilter } from './workMap.js';
import { formatFormDate } from './formDates.js';

/**
 * The work as a KMZ for Google Earth (design `o-12-mapa-exportar`), the same file Portal gives:
 * a folder «Ejecutado» with one folder per work, and «Pendiente» with the stretches still to do.
 * It exports what the map shows: the stage, the work and the day chosen. The file is built by
 * `@constroad/shared/obra` (one engine with Portal, 07/11); this only changes the shapes.
 */
export { KMZ_MIME } from '@constroad/shared/obra';

/** Lilachat's works already carry their resolved color, so each one goes as a tag. */
function kmlParamsOf(map: WorkMap, filter: WorkMapFilter, title: string): KmlParams {
  return {
    obraName: title,
    streets: map.streets.map((street) => ({ _id: street.id, name: street.name, geometry: street.line, lengthM: street.lengthM })),
    scopes: map.scopes.map((scope, index) => ({ _id: `${scope.streetId}:${index}`, streetId: scope.streetId, fromM: scope.fromM, toM: scope.toM, tagIds: scope.workIds, ...(scope.stageId ? { stageId: scope.stageId } : {}) })),
    progress: map.progress.map(({ streetId, workId, fromM, toM, date, rework }) => ({ streetId, workId, fromM, toM, date, rework })),
    partidas: [],
    tags: map.works.map((work) => ({ _id: work.id, name: work.name, color: work.color })),
    ...(filter.stageId ? { stageId: filter.stageId } : {}),
    ...(filter.workId ? { works: [filter.workId] } : {}),
    ...(filter.untilDay ? { upToDate: filter.untilDay } : {}),
    pending: 'planned',
    labels: 'progresiva',
  };
}

export const workMapKml = (map: WorkMap, filter: WorkMapFilter, title: string): string => buildWorkStreetsKml(kmlParamsOf(map, filter, title));

/** Google Earth opens a zip that holds `doc.kml`. */
export const workMapKmz = (kml: string): Uint8Array<ArrayBuffer> => zipOneFile('doc.kml', new TextEncoder().encode(kml));

/** What leaves the map, in words: «Etapa 1 · Asfaltado · Hasta el 5 nov». */
export function workMapScopeLabel(map: WorkMap, filter: WorkMapFilter): string {
  const stage = map.stages.find((one) => one.id === filter.stageId)?.name ?? 'Toda la obra';
  const work = map.works.find((one) => one.id === filter.workId)?.name;
  const day = filter.untilDay ? workMapCutLabel(filter.untilDay) : 'Hasta hoy';
  return [stage, work, day].filter(Boolean).join(' · ');
}

/** `pavimentacion-av-los-incas-2026-11-05.kmz`: the name says which work and which day, on the phone's calendar. */
export function workMapFileName(title: string, filter: WorkMapFilter, now: Date): string {
  const plain = title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${plain || 'mapa-de-la-obra'}-${filter.untilDay ?? formatFormDate(now, 'date')}.kmz`;
}
