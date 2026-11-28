import { useMemo, useState } from 'react';
import { ArrowLeft, Pointer } from 'lucide-react';
import { AVANCE_MANUAL_HINT, AVANCE_MANUAL_ONE, AVANCE_PICK_STREET, AVANCE_TITLE, addManualMark, avanceChipsOf, avanceHint, avanceLinesOf, avancePickedWork, avanceStreetAtTap, avanceTargetOf, manualHandlesOf, manualRangeOf, measureOnStreet, moveManualMark, tapReachM, type StreetEnd, type StreetHandle, type WorkMap, type WorkMapFilter, type WorkMapPoint, type WorkMapStreet } from '@lilachat/shared';
import { LayerChips } from './LayerChips';

/** «Marcar a mano» (José 28/11): two taps on the picked street set «desde» and «hasta»; the rings drag. */
function useManualMarks(street: WorkMapStreet | undefined) {
  const [on, setOn] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const range = on ? manualRangeOf(marks) : null;
  const handles = useMemo(() => (on ? manualHandlesOf(street, marks) : NO_HANDLES), [on, street, marks]);
  return {
    on, marks, range, handles,
    toggle: () => { setOn(!on); setMarks([]); },
    reset: () => setMarks([]),
    tap: (place: WorkMapPoint) => { if (street) setMarks(addManualMark(marks, measureOnStreet(street, place))); },
    drop: (handle: StreetEnd, place: WorkMapPoint) => { if (street) setMarks(moveManualMark(marks, handle, measureOnStreet(street, place))); },
  };
}

export type ManualMarks = ReturnType<typeof useManualMarks>;
const NO_HANDLES: StreetHandle[] = [];

/** «Modo Avance» (design av-01, José 27/11): on or off, the picked work and the tapped street. */
export function useAvanceMode(map: WorkMap, /** The board's stage and day cut: the chips' % as everywhere else. */ filter: WorkMapFilter) {
  const [on, setOn] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workId = avancePickedWork(map, chosen);
  const chips = useMemo(() => avanceChipsOf(map, workId, filter), [map, workId, filter]);
  const manual = useManualMarks(map.streets.find((one) => one.id === streetId));
  const lines = useMemo(() => avanceLinesOf(map, workId, streetId, manual.range), [map, workId, streetId, manual.range]);
  const target = on && workId && streetId ? avanceTargetOf(map, streetId, workId) : null;
  // A short patch on a long road is hard to hit: the reach grows as the map zooms out (José 28/11).
  const tap = (place: WorkMapPoint, _roads?: unknown, zoom?: number) => {
    if (manual.on && target) return manual.tap(place);
    const found = avanceStreetAtTap(map, place, tapReachM(zoom, place.lat));
    setError(found ? null : AVANCE_PICK_STREET);
    if (found && found !== streetId) { setStreetId(found); manual.reset(); }
  };
  const exit = () => { setOn(false); setStreetId(null); setError(null); manual.reset(); };
  const pick = (id: string) => { setChosen(id); setError(null); };
  return { on, open: () => setOn(true), exit, workId, chips, lines, target, error, tap, pick, manual, closeStreet: () => { setStreetId(null); manual.reset(); } };
}

export type AvanceModeState = ReturnType<typeof useAvanceMode>;

/** Over the map in «Modo Avance»: «Salir», the strip of works and what to tap. */
export function AvanceTop(props: { mode: AvanceModeState; title: string; /** «+ Trabajo» opens «Nueva capa» (ma03). */ onNewLayer: () => void }) {
  const { mode } = props;
  const workName = mode.chips.find((chip) => chip.selected)?.name ?? '';
  const hint = mode.manual.on && mode.target ? (mode.manual.marks.length === 1 ? AVANCE_MANUAL_ONE : AVANCE_MANUAL_HINT) : avanceHint(workName);
  return (
    <div data-testid="avance-modo" className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button type="button" data-testid="avance-salir" aria-label="Salir del modo avance" onClick={mode.exit} className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-outline/15 bg-surface text-on-surface shadow-md hover:bg-background"><ArrowLeft size={20} /></button>
        <div className="pointer-events-auto min-w-0 rounded-2xl bg-surface/90 px-3 py-1 shadow-md backdrop-blur">
          <p className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{props.title}</p>
          <p className="text-lg font-extrabold text-on-surface">{AVANCE_TITLE}</p>
        </div>
      </div>
      <LayerChips testPrefix="avance-trabajo" chips={mode.chips} onPick={mode.pick} onNewLayer={props.onNewLayer} />
      {mode.workId ? (
        <p data-testid="avance-pista" role={mode.error ? 'alert' : undefined} className={`pointer-events-auto flex items-center gap-2 self-start rounded-full bg-surface/95 px-3 py-2 text-[13px] font-semibold shadow-md backdrop-blur ${mode.error ? 'text-error' : 'text-on-surface'}`}>
          <Pointer size={16} className="shrink-0 text-primary" />{mode.error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
