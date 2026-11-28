import { Check, Plus } from 'lucide-react';
import { AVANCE_NO_WORKS, type AvanceChip } from '@lilachat/shared';
import { NewLayerButton } from './WorkLayers';

type ChipsProps = {
  chips: AvanceChip[];
  onPick: (id: string) => void;
  /** «+ Trabajo» and the empty state (Modo Avance); the main map has neither. */
  onNewLayer?: () => void;
  /** Test ids: `avance-trabajo-<id>` in Modo Avance, `mapa-capa-<id>` on the map (ma01). */
  testPrefix: string;
};

/**
 * The strip of layers (designs av-01 and ma01): 56 px chips with the colour dot, the FULL name and
 * the percent, the picked one with its check. Chips size to their text; the strip scrolls sideways.
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
        <button key={chip.id} type="button" data-testid={`${props.testPrefix}-${chip.id}`} aria-pressed={chip.selected} onClick={() => props.onPick(chip.id)} className={`flex h-14 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-5 text-[15px] font-semibold text-on-surface shadow-md ${chip.selected ? 'border-primary bg-primary/15' : 'border-outline/15 bg-surface hover:bg-background'}`}>
          <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: chip.color }} />
          {chip.label}
          {chip.selected ? <Check size={16} className="text-primary" /> : null}
        </button>
      ))}
      {props.onNewLayer ? <button type="button" data-testid="avance-trabajo-nuevo" onClick={props.onNewLayer} className="flex h-14 shrink-0 items-center gap-2 rounded-full border border-dashed border-primary/50 bg-surface px-5 text-[15px] font-semibold text-primary shadow-md hover:bg-background"><Plus size={16} />Trabajo</button> : null}
    </div>
  );
}
