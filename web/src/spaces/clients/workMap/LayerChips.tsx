import { Check, Plus } from 'lucide-react';
import { AVANCE_NO_WORKS, percentLabel, type AvanceChip } from '@lilachat/shared';
import { NewLayerButton } from './WorkLayers';
import { LAYER_DOT } from './LayerSheet';

type ChipsProps = {
  chips: AvanceChip[];
  onPick: (id: string) => void;
  /** «+ Trabajo» and the empty state (Modo Avance); the main map has neither. */
  onNewLayer?: () => void;
  /** Test ids: `avance-trabajo-<id>` in Modo Avance, `mapa-capa-<id>` on the map (ma01). */
  testPrefix: string;
};

/**
 * The strip of layers (designs av-01 and ma01): compact 40 px chips (José 28/11: «está grandazo»)
 * with the colour dot, the name and the percent; the picked one raised with a small check. A long
 * name gives way to the percent, so 3–4 chips fit across a phone. The strip scrolls sideways.
 */
export function LayerChips(props: ChipsProps) {
  if (!props.chips.length) {
    return props.onNewLayer ? (
      <div data-testid="avance-sin-trabajos" className="pointer-events-auto space-y-2 rounded-2xl bg-surface p-3 shadow-md">
        <p className="text-[13px] text-on-surface">{AVANCE_NO_WORKS}</p>
        <NewLayerButton testId="trabajo-nueva" label="Agregar trabajo" onClick={props.onNewLayer} />
      </div>
    ) : null;
  }
  return (
    <div role="group" aria-label="Capas" className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
      {props.chips.map((chip) => (
        <button key={chip.id} type="button" data-testid={`${props.testPrefix}-${chip.id}`} aria-pressed={chip.selected} aria-label={chip.label} onClick={() => props.onPick(chip.id)} className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-[14px] text-on-surface shadow-md ${chip.selected ? 'border-primary/60 bg-surface font-bold' : 'border-outline/15 bg-surface/90 font-medium hover:bg-background'}`}>
          <span aria-hidden className={LAYER_DOT} style={{ backgroundColor: chip.color }} />
          <span className="max-w-[132px] truncate">{chip.name}</span>{' '}
          <span className="font-mono text-[13px] font-normal text-on-surface-variant">{percentLabel(chip.percent)}</span>
          {chip.selected ? <Check size={14} className="text-primary" /> : null}
        </button>
      ))}
      {props.onNewLayer ? <button type="button" data-testid="avance-trabajo-nuevo" onClick={props.onNewLayer} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-surface px-3 text-[14px] font-semibold text-primary shadow-md hover:bg-background"><Plus size={14} />Trabajo</button> : null}
    </div>
  );
}
