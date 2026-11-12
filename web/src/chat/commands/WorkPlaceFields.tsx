import { LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { precisionNoteOf, streetOptionsOf, type FormField, type GeoPoint, type WorkMapStreet } from '@lilachat/shared';
import { FieldError } from '../../ui/Overlay';
import { ChoiceField, Label } from './AppFormFields';
import type { ReadingState } from './useFieldAutofill';

const NO_STREETS = 'No hay calles del mapa de obra para elegir.';
const DENIED = 'No se pudo leer el GPS. Activa la ubicación del navegador y vuelve a intentar.';

/** The point's place (CON-CAP): one block for the three `gps` numbers, read on opening, taken again on demand. */
export function GpsReadingField(props: { reading: GeoPoint | null; state: ReadingState; error?: string; onTake: () => void }) {
  const { reading, state } = props;
  const note = reading ? precisionNoteOf(reading.precision || undefined) : null;
  const tone = note?.tone === 'ok' ? 'border-en-linea/30 bg-en-linea/10 text-en-linea' : 'border-warning/30 bg-warning/10 text-warning';
  return (
    <div data-testid="campo-gps" className="rounded-2xl border border-outline/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[14px] font-semibold"><MapPin size={16} className="text-primary" /> Ubicación del punto</p>
        {state === 'asking' ? <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant"><LocateFixed size={14} className="animate-pulse" /> Buscando…</span> : null}
        {state !== 'asking' ? (
          <button type="button" data-testid="gps-tomar" onClick={props.onTake} className="flex h-9 items-center gap-1.5 rounded-lg border border-outline/25 px-3 text-[13px] font-semibold text-primary"><RefreshCw size={14} /> {reading ? 'Volver a tomar' : 'Tomar ubicación'}</button>
        ) : null}
      </div>
      {reading ? <p data-testid="gps-coordenadas" className="mt-1 font-mono text-[12px] tabular-nums text-on-surface-variant">{reading.lat.toFixed(6)}, {reading.lng.toFixed(6)}</p> : null}
      {note ? <p data-testid="gps-precision" className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${tone}`}>{note.text}</p> : null}
      {state === 'denied' ? <p className="mt-2 text-[13px] text-on-surface-variant">{DENIED}</p> : null}
      <FieldError>{props.error}</FieldError>
    </div>
  );
}

type StreetProps = { field: Extract<FormField, { kind: 'text' }>; value: unknown; error?: string; onChange: (value: unknown) => void; streets: readonly WorkMapStreet[] | null; reading: GeoPoint | null };

/** A street of the service's work map, the nearest one already picked; the engineer can change it. */
export function WorkStreetField({ field, value, error, onChange, streets, reading }: StreetProps) {
  if (!streets || streets.length === 0) {
    return (
      <div data-testid={`campo-${field.name}`}>
        <Label field={field} />
        {streets ? <p className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">{NO_STREETS}</p> : <div className="h-11 animate-pulse rounded-xl bg-surface" />}
        <FieldError>{error}</FieldError>
      </div>
    );
  }
  const choice = { ...field, kind: 'choice' as const, options: streetOptionsOf(streets, reading), segmented: false, searchable: true };
  return <ChoiceField field={choice} value={value} error={error} onChange={onChange} />;
}
