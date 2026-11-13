import { useEffect, useRef } from 'react';
import { fillConditions, type FieldConditions, type FormField, type FormValues, type GeoPoint } from '@lilachat/shared';
import { devicePlaceNow } from '../../spaces/clients/reports/devicePlace';

/** The street and the weather of a reading, from the server; null when they do not arrive. */
export type ConditionsLookup = (point: GeoPoint) => Promise<FieldConditions | null>; // gates-allow: duplicate (the APK and the web are two bundles; each imports its own devicePlaceNow)

/** A report's «Información de control» fills itself on opening (José 12/11): `fillConditions` in shared. */
export function useConditionsAutofill(params: { fields: readonly FormField[]; values: FormValues; fill: (next: FormValues) => void; ask?: ConditionsLookup }): void {
  const latest = useRef(params);
  latest.current = params;
  useEffect(() => {
    const ask = latest.current.ask;
    if (!ask) return undefined;
    let open = true;
    void fillConditions({ fields: params.fields, current: () => latest.current.values, fill: (next) => latest.current.fill(next), locate: devicePlaceNow, ask, open: () => open });
    return () => {
      open = false;
    };
  }, [params.fields, params.ask]);
}
