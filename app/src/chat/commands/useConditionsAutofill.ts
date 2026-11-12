import { useEffect, useRef } from 'react';
import { conditionRolesOf, conditionValues, needsReading, type FieldConditions, type FormField, type FormValues, type GeoPoint } from '@lilachat/shared';
import { devicePlaceNow } from '../../spaces/clients/reports/devicePlace';

/** The street and the weather of a reading, from the server; null when they do not arrive. */
export type ConditionsLookup = (point: GeoPoint) => Promise<FieldConditions | null>;
type Params = { fields: readonly FormField[]; values: FormValues; fill: (next: FormValues) => void; ask?: ConditionsLookup };

const hasAny = (values: FormValues): boolean => Object.keys(values).length > 0;

/**
 * A report's «Información de control» fills itself (José 12/11): the shift by the phone's hour at
 * once, then the street and the weather of where the engineer stands. Only empty fields, once, on
 * opening; whatever the person typed meanwhile stays. The twin of the other side's hook.
 */
export function useConditionsAutofill({ fields, values, fill, ask }: Params): void {
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const fillRef = useRef(fill);
  fillRef.current = fill;
  useEffect(() => {
    if (!ask || !hasAny(conditionRolesOf(fields))) return undefined;
    const now = new Date();
    const atOnce = conditionValues(fields, valuesRef.current, { now, conditions: null });
    if (hasAny(atOnce)) fillRef.current(atOnce);
    if (!needsReading(fields, valuesRef.current)) return undefined;
    let open = true;
    void (async () => {
      const place = await devicePlaceNow();
      if (!open || place.lat === undefined || place.lng === undefined) return;
      const conditions = await ask({ lat: place.lat, lng: place.lng, precision: 0 });
      if (!open || !conditions) return;
      const arrived = conditionValues(fields, { ...valuesRef.current, ...atOnce }, { now, conditions });
      if (hasAny(arrived)) fillRef.current(arrived);
    })();
    return () => {
      open = false;
    };
  }, [fields, ask]);
}
