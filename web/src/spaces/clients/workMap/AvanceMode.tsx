import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Plus, Pointer } from 'lucide-react';
import { AVANCE_NO_WORKS, AVANCE_PICK_STREET, AVANCE_TITLE, avanceChipsOf, avanceHint, avancePickedWork, avanceTargetOf, brushLinesOf, stretchLineOf, streetAtTap, type AvanceChip, type WorkMap, type WorkMapLine, type WorkMapPoint } from '@lilachat/shared';
import { NewLayerButton } from './WorkLayers';

/** The work's stretches in its colour and the tapped street on top, in the stretch colour. */
function linesOf(map: WorkMap, workId: string | null, streetId: string | null): WorkMapLine[] {
  const own = workId ? brushLinesOf(map, { kind: 'work', id: workId }) : [];
  const street = map.streets.find((one) => one.id === streetId);
  const picked = street ? stretchLineOf(map, street.id, 0, street.lengthM) : null;
  return picked ? [...own, picked] : own;
}

/** «Modo Avance» (design av-01, José 27/11): on or off, the picked work and the tapped street. */
export function useAvanceMode(map: WorkMap) {
  const [on, setOn] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workId = avancePickedWork(map, chosen);
  const chips = useMemo(() => avanceChipsOf(map, workId), [map, workId]);
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

function WorkChips(props: { chips: AvanceChip[]; onPick: (id: string) => void; onNewLayer: () => void }) {
  if (!props.chips.length) {
    return (
      <div data-testid="avance-sin-trabajos" className="pointer-events-auto space-y-2 rounded-2xl bg-surface p-3 shadow-md">
        <p className="text-[13px] text-on-surface">{AVANCE_NO_WORKS}</p>
        <NewLayerButton testId="trabajo-nueva" label="Agregar trabajo" onClick={props.onNewLayer} />
      </div>
    );
  }
  return (
    <div role="group" aria-label="Trabajos" className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
      {props.chips.map((chip) => (
        <button key={chip.id} type="button" data-testid={`avance-trabajo-${chip.id}`} aria-pressed={chip.selected} onClick={() => props.onPick(chip.id)} className={`flex h-14 shrink-0 items-center gap-2 rounded-full border px-5 text-[15px] font-semibold text-on-surface shadow-md ${chip.selected ? 'border-primary bg-primary/15' : 'border-outline/15 bg-surface hover:bg-background'}`}>
          <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: chip.color }} />
          {chip.label}
          {chip.selected ? <Check size={16} className="text-primary" /> : null}
        </button>
      ))}
      <button type="button" data-testid="avance-trabajo-nuevo" onClick={props.onNewLayer} className="flex h-14 shrink-0 items-center gap-2 rounded-full border border-dashed border-primary/50 bg-surface px-5 text-[15px] font-semibold text-primary shadow-md hover:bg-background"><Plus size={16} />Trabajo</button>
    </div>
  );
}

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
      <WorkChips chips={mode.chips} onPick={mode.pick} onNewLayer={props.onNewLayer} />
      {mode.workId ? (
        <p data-testid="avance-pista" role={mode.error ? 'alert' : undefined} className={`pointer-events-auto flex items-center gap-3 self-start rounded-full bg-surface/95 px-4 py-2.5 text-[13px] font-semibold shadow-md backdrop-blur ${mode.error ? 'text-error' : 'text-on-surface'}`}>
          <Pointer size={18} className="shrink-0 text-primary" />{mode.error ?? avanceHint(workName)}
        </p>
      ) : null}
    </div>
  );
}
