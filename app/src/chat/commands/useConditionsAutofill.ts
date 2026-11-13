import { useEffect, useRef } from 'react';
import { startConditionsFill, type FieldConditions, type FormField, type FormValues, type GeoPoint } from '@lilachat/shared';
import { devicePlaceNow } from '../../spaces/clients/reports/devicePlace';

/** The street and the weather of a reading, from the server; null when they do not arrive. */
export type ConditionsLookup = (point: GeoPoint) => Promise<FieldConditions | null>;

/** A report's «Información de control» fills itself on opening (José 12/11): shared's `fillConditions`. */
export function useConditionsAutofill(params: { fields: readonly FormField[]; values: FormValues; fill: (next: FormValues) => void; ask?: ConditionsLookup }): void {
  const latest = useRef(params);
  latest.current = params;
  useEffect(() => startConditionsFill(latest, devicePlaceNow), [params.fields, params.ask]);
}
