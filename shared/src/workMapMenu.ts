import { percentLabel, type WorkMapFilter, type WorkMapView, type WorkMapWork } from './workMap.js';
import { STREET_DEFINED_COLOR, STREET_DEFINED_LEGEND } from './workLayerLines.js';

/**
 * The work map's bar, kept short (José 09/11: «todo amontonado»). The design (o-01) has three
 * actions: «Registrar avance», «Compartir» and one more; everything else goes under «Más».
 * The works filter is a select and the legend folds. PURE: the APK and the web draw from here.
 */
export type MapMoreKey = 'share' | 'screen' | 'record' | 'avance' | 'croquis' | 'area' | 'draw' | 'stages' | 'works' | 'export' | 'open' | 'deleted';
/** «Pantalla completa» to enter it, or the way out once inside. */
export type MapScreenItem = 'open' | 'close';
export type MapMoreItem = { key: MapMoreKey; label: string };
export type WorkChoice = { id: string; label: string; color: string | null };
export type MapLegendEntry = { key: string; kind: 'work' | 'todo' | 'defined'; label: string; color: string | null };

const ALL_WORKS = 'Todos los trabajos';

/**
 * What «Más» offers: drawing and layers to who edits, «Borrados» to an admin who edits. José 20/11
 * (design mapa-v2): «Compartir avance» and «Pantalla completa» moved in here, first.
 */
export function mapMoreItems(can: { draws: boolean; edits: boolean; admin: boolean; share?: boolean; screen?: MapScreenItem; /** José 28/11 (ma01): «Modo avance» and «Editar croquis» left the foot of the map for here. */ fieldTools?: boolean; /** «Registrar avance» only when no layer sheet carries it. */ record?: boolean }): MapMoreItem[] {
  const tools = Boolean(can.fieldTools) && can.edits;
  const items: Array<MapMoreItem | false> = [
    Boolean(can.share) && { key: 'share', label: 'Compartir avance' },
    Boolean(can.screen) && { key: 'screen', label: can.screen === 'close' ? 'Salir de pantalla completa' : 'Pantalla completa' },
    tools && Boolean(can.record) && { key: 'record', label: 'Registrar avance' },
    tools && { key: 'avance', label: 'Modo avance' },
    tools && { key: 'croquis', label: 'Editar croquis' },
    // ma02 (28/11): several streets at once first; the one-street editor stays for a single one.
    can.draws && { key: 'area', label: 'Marcar calles' },
    can.draws && { key: 'draw', label: 'Una sola calle' },
    can.edits && { key: 'stages', label: 'Etapas' },
    can.edits && { key: 'works', label: 'Trabajos' },
    { key: 'export', label: 'Exportar' },
    { key: 'open', label: 'Abrir en Portal' },
    can.edits && can.admin && { key: 'deleted', label: 'Borrados' },
  ];
  return items.filter((item): item is MapMoreItem => Boolean(item));
}

const workLabel = (work: WorkMapView['works'][number]) => `${work.name} · ${percentLabel(work.percent)}`;

export const workChoicesOf = (view: Pick<WorkMapView, 'works'>): WorkChoice[] => [
  { id: '', label: ALL_WORKS, color: null },
  ...view.works.map((work) => ({ id: work.id, label: workLabel(work), color: work.color })),
];

export function workChoiceLabel(view: Pick<WorkMapView, 'works'>, workId: string | undefined): string {
  const work = view.works.find((one) => one.id === workId);
  return work ? workLabel(work) : ALL_WORKS;
}

/** «Convenciones»: each work and what is still to build; nothing waits for approval (José 28/11). */
export function mapLegendEntries(view: Pick<WorkMapView, 'works'>): MapLegendEntry[] {
  const works = view.works.map((work) => ({ key: work.id, kind: 'work' as const, label: work.name, color: work.color }));
  const todo: MapLegendEntry = { key: 'todo', kind: 'todo', label: 'Pendiente de ejecución', color: null };
  return [...works, todo];
}

/** The orange of a street drawn with no work painted yet, when the map has one. */
export const definedLegendEntries = (count: number): MapLegendEntry[] =>
  (count > 0 ? [{ key: 'defined', kind: 'defined', label: STREET_DEFINED_LEGEND, color: STREET_DEFINED_COLOR }] : []);

const PAVING = /carpeta|asfalt/;
/** Asphalt that is not the mat: the prime coat and the tack coat have their own report. */
const NOT_PAVING = /imprima|riego|liga/;
const plain = (name: string): string => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «Colocación de carpeta asfáltica»: the work the Control de pista measures. Works carry only a name. */
export const isPavingWork = (work: Pick<WorkMapWork, 'name'>): boolean => {
  const name = plain(work.name);
  return PAVING.test(name) && !NOT_PAVING.test(name);
};

/**
 * The units' numbers and plates, and the stretches they suggest, only with the paving work chosen (José 09/11).
 * A service without streets has no works to choose: its units always show, to see where they emptied (Portal via José 09/11).
 */
export function showsUnitPins(map: { works: ReadonlyArray<Pick<WorkMapWork, 'id' | 'name'>>; streets?: readonly unknown[] }, filter: Pick<WorkMapFilter, 'workId'>): boolean {
  if (map.streets?.length === 0) return true;
  const chosen = map.works.find((work) => work.id === filter.workId);
  return Boolean(chosen && isPavingWork(chosen));
}
