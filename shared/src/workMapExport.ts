import { stationLabel, WORK_MAP_PLANNED_COLOR, workMapCutLabel, workMapView, type WorkMap, type WorkMapFilter, type WorkMapLine } from './workMap.js';
import { formatFormDate } from './formDates.js';
import { zipOneFile } from './zipStore.js';

/**
 * The work as a KMZ for Google Earth (design `o-12-mapa-exportar`), the same file Portal gives:
 * a folder «Ejecutado» with one folder per work, and «Pendiente» with the stretches still to do.
 * It exports what the map shows: the stage, the work and the day chosen. PURE: the APK and the
 * web only save the bytes.
 */
export const KMZ_MIME = 'application/vnd.google-earth.kmz';

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
/** A work called «Av. Perú & Cía.» would break the whole file. */
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
const OPAQUE = 'ff';
const SEE_THROUGH = 'aa';
const DONE_WIDTH = 6;
const PENDING_WIDTH = 4;
const UNKNOWN_COLOR = '888888';

/** KML writes `AABBGGRR`: alpha first and the channels reversed. In CSS order the base turns light blue. */
export function kmlColor(hex: string, alpha = OPAQUE): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `${alpha}${UNKNOWN_COLOR}`;
  return `${alpha}${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`.toLowerCase();
}

/** KML asks `lng,lat,alt`; MapLibre's lines already come in that order. */
const coordinatesOf = (line: WorkMapLine) => line.coordinates.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
const styleOf = (id: string, color: string, width: number) => `<Style id="${id}"><LineStyle><color>${color}</color><width>${width}</width></LineStyle></Style>`;
const placemarkOf = (name: string, styleId: string, line: WorkMapLine) =>
  `<Placemark><name>${escapeXml(name)}</name><styleUrl>#${styleId}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${coordinatesOf(line)}</coordinates></LineString></Placemark>`;
const folderOf = (name: string, body: string[]) => (body.length ? `<Folder><name>${escapeXml(name)}</name>${body.join('')}</Folder>` : '');

const stretchName = (street: string, line: WorkMapLine) =>
  line.fromM === undefined || line.toM === undefined ? street : `${street} · ${stationLabel(line.fromM)} a ${stationLabel(line.toM)}`;

export function workMapKml(map: WorkMap, filter: WorkMapFilter, title: string): string {
  const view = workMapView(map, filter);
  const streetName = (id: string) => map.streets.find((street) => street.id === id)?.name ?? 'Calle';
  const works = map.works.filter((work) => view.done.some((line) => line.workId === work.id));
  const done = works.map((work, index) => folderOf(work.name, view.done.filter((line) => line.workId === work.id).map((line) => placemarkOf(stretchName(streetName(line.streetId), line), `trabajo-${index}`, line))));
  const pending = view.planned.map((line) => placemarkOf(streetName(line.streetId), 'pendiente', line));
  const styles = [styleOf('pendiente', kmlColor(WORK_MAP_PLANNED_COLOR, SEE_THROUGH), PENDING_WIDTH), ...works.map((work, index) => styleOf(`trabajo-${index}`, kmlColor(work.color), DONE_WIDTH))];
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(title)}</name>${styles.join('')}${folderOf('Ejecutado', done.filter(Boolean))}${folderOf('Pendiente', pending)}</Document></kml>`;
}

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
