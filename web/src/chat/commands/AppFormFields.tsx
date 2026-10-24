import { useEffect, useRef, useState } from 'react';
import { Camera, LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { geoPointOf, mapTilesFor, precisionLabel, type FormField, type GeoPoint } from '@lilachat/shared';
import { FieldError } from '../../ui/Overlay';
import { SearchableChoice } from './SearchableChoice';

const MAP = { width: 320, height: 120 };
const PIN = 26;
/** The browser asks for the location once; a phone outdoors answers within seconds. */
const LOCATION_TIMEOUT_MS = 15_000;
const inputClass = 'h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[15px] outline-none focus:border-primary';

type FieldProps<K extends FormField['kind']> = { field: Extract<FormField, { kind: K }>; value: unknown; error?: string; onChange: (value: unknown) => void };

function Label(props: { field: FormField }) {
  return (
    <p className="mb-1.5 text-[13px] font-semibold text-on-surface">
      {props.field.label}
      {props.field.required ? null : <span className="font-normal text-on-surface-variant"> · opcional</span>}
    </p>
  );
}

/** Up to four side by side (design e-28), more in a list. */
export function ChoiceField({ field, value, error, onChange }: FieldProps<'choice'>) {
  return (
    <div>
      {field.options.length === 0 ? (
        <>
          <Label field={field} />
          <p data-testid={`sin-opciones-${field.name}`} className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">No hay opciones para elegir</p>
        </>
      ) : field.segmented ? (
        <div role="radiogroup" aria-label={field.label} className="grid gap-1 rounded-2xl border border-outline/15 bg-background p-1" style={{ gridTemplateColumns: `repeat(${field.options.length}, minmax(0, 1fr))` }}>
          {field.options.map((option) => (
            <button key={option.value} type="button" role="radio" aria-checked={value === option.value} data-testid={`opcion-${field.name}-${option.value}`} onClick={() => onChange(option.value)} className={`h-11 rounded-xl px-1 text-[14px] font-semibold transition-colors ${value === option.value ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface'}`}>
              {option.label}
            </button>
          ))}
        </div>
      ) : field.searchable ? (
        <>
          <Label field={field} />
          <SearchableChoice field={field} value={value} onChange={onChange} />
        </>
      ) : (
        <>
          <Label field={field} />
          <select data-testid={`campo-${field.name}`} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={inputClass}>
            <option value="">Elige…</option>
            {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </>
      )}
      {field.help ? <p className="mt-1 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function TextField({ field, value, error, onChange }: FieldProps<'text'>) {
  const text = typeof value === 'string' ? value : '';
  return (
    <div>
      <Label field={field} />
      {field.multiline ? (
        <textarea data-testid={`campo-${field.name}`} value={text} maxLength={field.maxLength} rows={3} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-outline/25 bg-background px-3 py-2 text-[15px] outline-none focus:border-primary" />
      ) : (
        <input
          data-testid={`campo-${field.name}`}
          value={text}
          maxLength={field.digits ?? field.maxLength}
          // A one-time code (connecting an account): the number pad, the code autofill and big spread digits.
          {...(field.digits ? { inputMode: 'numeric' as const, autoComplete: 'one-time-code' } : {})}
          // A PIN (Portal's employee PIN, agentes 24/10): hidden, the number pad, never remembered by the browser.
          {...(field.secret ? { type: 'password', inputMode: 'numeric' as const, autoComplete: 'off' } : {})}
          onChange={(event) => onChange(event.target.value)}
          className={field.digits ? `${inputClass} text-center text-2xl font-bold tracking-[0.5em] tabular-nums` : inputClass}
        />
      )}
      {field.help ? <p className="mt-1 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function NumberField({ field, value, error, onChange }: FieldProps<'number'>) {
  return (
    <div>
      <Label field={field} />
      <div className="flex items-center gap-2">
        {/* The mouse wheel must not change a measurement while the page scrolls. */}
        <input data-testid={`campo-${field.name}`} type="number" inputMode={field.integer ? 'numeric' : 'decimal'} min={field.min} max={field.max} step={field.integer ? 1 : 'any'} value={typeof value === 'number' || typeof value === 'string' ? value : ''} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)} className={inputClass} />
        {field.unit ? <span className="shrink-0 text-[14px] font-semibold text-on-surface-variant">{field.unit}</span> : null}
      </div>
      {field.help ? <p className="mt-1 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function DateField({ field, value, error, onChange }: FieldProps<'date'>) {
  return (
    <div>
      <Label field={field} />
      <input data-testid={`campo-${field.name}`} type={field.withTime ? 'datetime-local' : 'date'} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** «Tu ubicación» with its precision and a still map (the shared location's tiles); asked once, on opening. */
export function LocationField({ field, value, error, onChange }: FieldProps<'location'>) {
  const [state, setState] = useState<'asking' | 'denied' | 'ready'>(value ? 'ready' : 'asking');
  const point = value as GeoPoint | undefined;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const ask = () => {
    if (!navigator.geolocation) return setState('denied');
    setState('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChangeRef.current(geoPointOf(position.coords));
        setState('ready');
      },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 }
    );
  };
  useEffect(() => {
    if (!value) ask();
    // Asked once when the form opens; «Reintentar» asks again.
  }, []);
  const map = point ? mapTilesFor({ lat: point.lat, lng: point.lng, accuracy: point.precision }, MAP) : null;
  return (
    <div className="rounded-2xl border border-outline/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">{field.label}</p>
        {state === 'ready' && point ? <span data-testid={`precision-${field.name}`} className="flex items-center gap-1.5 rounded-full border border-en-linea/30 bg-en-linea/10 px-2.5 py-1 text-[12px] font-semibold text-en-linea"><span className="h-1.5 w-1.5 rounded-full bg-en-linea" />{precisionLabel(point)}</span> : null}
        {state === 'asking' ? <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant"><LocateFixed size={14} className="animate-pulse" /> Buscando…</span> : null}
      </div>
      {map ? (
        <div className="relative overflow-hidden rounded-xl bg-background" style={{ height: MAP.height }}>
          {map.tiles.map((tile) => <img key={tile.url} src={tile.url} alt="" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />)}
          <span className="absolute text-primary" style={{ left: map.pin.left - PIN / 2, top: map.pin.top - PIN }}><MapPin size={PIN} fill="currentColor" stroke="white" strokeWidth={1.5} /></span>
          <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
        </div>
      ) : null}
      {state === 'denied' ? (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-[13px] text-on-surface-variant">No se pudo leer tu ubicación. Permite la ubicación en el navegador.</p>
          <button type="button" onClick={ask} className="flex h-9 items-center gap-1.5 rounded-lg border border-outline/25 px-3 text-[13px] font-semibold text-primary"><RefreshCw size={14} /> Reintentar</button>
        </div>
      ) : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** The photo goes up the moment it is picked; the form carries its id (`uploadFormPhoto`). */
export function PhotoField({ field, value, error, onChange, upload }: FieldProps<'photo'> & { upload: (file: File) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }> }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ busy: boolean; message?: string }>({ busy: false });
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStatus({ busy: true });
    onChange(undefined);
    const uploaded = await upload(file);
    if (uploaded.ok) onChange(uploaded.fileId);
    setStatus({ busy: false, ...(uploaded.ok ? {} : { message: uploaded.message }) });
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-outline/15 p-3">
      <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-outline/30 bg-background text-on-surface-variant">
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera size={30} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{field.label}</p>
        {field.help ? <p className="text-[12px] text-on-surface-variant">{field.help}</p> : null}
        <input ref={input} data-testid={`campo-${field.name}`} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
        <button type="button" disabled={status.busy} onClick={() => input.current?.click()} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-outline/25 text-[14px] font-semibold text-on-surface disabled:opacity-50">
          <Camera size={16} className="text-primary" /> {status.busy ? 'Subiendo…' : value ? 'Cambiar foto' : 'Tomar foto'}
        </button>
        <FieldError>{status.message ?? error}</FieldError>
      </div>
    </div>
  );
}
