import { useMemo, useState } from 'react';
import { ArrowLeft, Pointer } from 'lucide-react';
import { AVANCE_PICK_STREET, AVANCE_TITLE, avanceChipsOf, avanceHint, avancePickedWork, avanceTargetOf, brushLinesOf, stretchLineOf, streetAtTap, type WorkMap, type WorkMapFilter, type WorkMapLine, type WorkMapPoint } from '@lilachat/shared';
import { LayerChips } from './LayerChips';

/** The work's stretches in its colour and the tapped street on top, in the stretch colour. */
function linesOf(map: WorkMap, workId: string | null, streetId: string | null): WorkMapLine[] {
  const own = workId ? brushLinesOf(map, { kind: 'work', id: workId }) : [];
  const street = map.streets.find((one) => one.id === streetId);
  const picked = street ? stretchLineOf(map, street.id, 0, street.lengthM) : null;
  return picked ? [...own, picked] : own;
}

/** «Modo Avance» (design av-01, José 27/11): on or off, the picked work and the tapped street. */
export function useAvanceMode(map: WorkMap, /** The board's stage and day cut: the chips' % as everywhere else. */ filter: WorkMapFilter) {
  const [on, setOn] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workId = avancePickedWork(map, chosen);
  const chips = useMemo(() => avanceChipsOf(map, workId, filter), [map, workId, filter]);
  const lines = useMemo(() => linesOf(map, workId, streetId), [map, workId, streetId]);
  const target = on && workId && streetId ? avanceTargetOf(map, streetId, workId) : null;
  const tap = (place: WorkMapPoint) => {
    const found = streetAtTap(map, place);
    setError(found ? null : AVANCE_PICK_STREET);
    if (found) setStreetId(found);
  };
  const exit = () => { setOn(false); setStreetId(null); setError(null); };
  const pick = (id: string) => { setChosen(id); setError(null); };
  return { on, open: () => setOn(true), exit, workId, chips, lines, target, error, tap, pick, closeStreet: () => setStreetId(null) };
}

export type AvanceModeState = ReturnType<typeof useAvanceMode>;

/** Over the map in «Modo Avance»: «Salir», the strip of works and what to tap. */
export function AvanceTop(props: { mode: AvanceModeState; title: string; /** «+ Trabajo» opens «Nueva capa» (ma03). */ onNewLayer: () => void }) {
  const { mode } = props;
  const workName = mode.chips.find((chip) => chip.selected)?.name ?? '';
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
        <p data-testid="avance-pista" role={mode.error ? 'alert' : undefined} className={`pointer-events-auto flex items-center gap-3 self-start rounded-full bg-surface/95 px-4 py-2.5 text-[13px] font-semibold shadow-md backdrop-blur ${mode.error ? 'text-error' : 'text-on-surface'}`}>
          <Pointer size={18} className="shrink-0 text-primary" />{mode.error ?? avanceHint(workName)}
        </p>
      ) : null}
    </div>
  );
}
