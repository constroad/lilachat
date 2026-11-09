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

/** One chip per day with its color on the map; nothing with a single day. */
export function MapDayChips(props: { options: MapDayOption[]; day: string; onDay: (day: string) => void }) {
  if (!props.options.length) return null;
  return (
    <div data-testid="mapa-dias" role="group" aria-label="Día de colocación" className="flex gap-2 overflow-x-auto">
      {props.options.map((option) => {
        const on = option.key === props.day;
        return (
          <button key={option.key} type="button" data-testid={`mapa-dia-${option.key}`} aria-pressed={on} onClick={() => props.onDay(option.key)} className={`flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 bg-surface text-on-surface'}`}>
            {option.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
