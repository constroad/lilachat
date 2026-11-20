import { useMemo, useState } from 'react';
import { ALL_DAYS, mapDayOptions, mediaOfDay, type MapDayOption, type MapPhoto, type UnitDischarge } from '@lilachat/shared';

/** «Todos» or one day of placement (José 09/11, Globofast): what the map shows of photos and units. */
export function useMapDays(photos: MapPhoto[], units: UnitDischarge[]) {
  const [day, setDay] = useState(ALL_DAYS);
  const options = useMemo(() => mapDayOptions(photos, units), [photos, units]);
  const shown = useMemo(() => mediaOfDay(photos, units, day), [photos, units, day]);
  const days = useMemo(() => options.slice(1).map((one) => one.key), [options]);
  return { day, setDay, options, days, photos: shown.photos };
}

/**
 * One chip per day with its color on the map; nothing with a single day. José 20/11 (design
 * mapa-v2): they float over the map, each day with how many photos and units it holds.
 */
export function MapDayChips(props: { options: MapDayOption[]; day: string; onDay: (day: string) => void }) {
  if (!props.options.length) return null;
  return (
    <div data-testid="mapa-dias" role="group" aria-label="Día de colocación" className="flex min-w-0 gap-2 overflow-x-auto pb-1">
      {props.options.map((option) => {
        const on = option.key === props.day;
        return (
          <button key={option.key} type="button" data-testid={`mapa-dia-${option.key}`} aria-pressed={on} onClick={() => props.onDay(option.key)} className={`pointer-events-auto flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold shadow-sm ${on ? 'border-primary bg-primary text-on-primary' : 'border-outline/15 bg-surface text-on-surface'}`}>
            {option.color ? <span className="h-2.5 w-2.5 rounded-full ring-1 ring-surface" style={{ backgroundColor: option.color }} /> : null}
            {option.label}
            {option.color ? <span className={`font-mono text-[11px] tabular-nums ${on ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{`· ${option.count}`}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
