import { percentLabel, type WorkMapFilter, type WorkMapView, type WorkMapWork } from './workMap.js';

/**
 * The work map's bar, kept short (José 09/11: «todo amontonado»). The design (o-01) has three
 * actions: «Registrar avance», «Compartir» and one more; everything else goes under «Más».
 * The works filter is a select and the legend folds. PURE: the APK and the web draw from here.
 */
export type MapMoreKey = 'draw' | 'stages' | 'works' | 'export' | 'open' | 'deleted';
export type MapMoreItem = { key: MapMoreKey; label: string };
export type WorkChoice = { id: string; label: string; color: string | null };
export type MapLegendEntry = { key: string; kind: 'work' | 'todo' | 'waiting'; label: string; color: string | null };

const ALL_WORKS = 'Todos los trabajos';

/** What «Más» offers: drawing and layers to who edits, «Borrados» to an admin who edits. */
export function mapMoreItems(can: { draws: boolean; edits: boolean; admin: boolean }): MapMoreItem[] {
  const items: Array<MapMoreItem | false> = [
    can.draws && { key: 'draw', label: 'Nueva calle' },
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

/** «Convenciones»: each work, what is still to build and, when something waits, what is to approve. */
export function mapLegendEntries(view: Pick<WorkMapView, 'works'>, waiting: number): MapLegendEntry[] {
  const works = view.works.map((work) => ({ key: work.id, kind: 'work' as const, label: work.name, color: work.color }));
  const todo: MapLegendEntry = { key: 'todo', kind: 'todo', label: 'Pendiente de ejecución', color: null };
  const toApprove: MapLegendEntry[] = waiting > 0 ? [{ key: 'waiting', kind: 'waiting', label: `Por aprobar (${waiting})`, color: null }] : [];
  return [...works, todo, ...toApprove];
}

const PAVING = /carpeta|asfalt/;
/** Asphalt that is not the mat: the prime coat and the tack coat have their own report. */
const NOT_PAVING = /imprima|riego|liga/;
const plain = (name: string): string => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «Colocación de carpeta asfáltica»: the work the Control de pista measures. Works carry only a name. */
export const isPavingWork = (work: Pick<WorkMapWork, 'name'>): boolean => {
  const name = plain(work.name);
  return PAVING.test(name) && !NOT_PAVING.test(name);
};

/** The units' numbers and plates, and the stretches they suggest, only with the paving work chosen (José 09/11). */
export function showsUnitPins(map: { works: ReadonlyArray<Pick<WorkMapWork, 'id' | 'name'>> }, filter: Pick<WorkMapFilter, 'workId'>): boolean {
  const chosen = map.works.find((work) => work.id === filter.workId);
  return Boolean(chosen && isPavingWork(chosen));
}
