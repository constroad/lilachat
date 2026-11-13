import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, LocateFixed, Ruler, X } from 'lucide-react';
import { areaDraftKey, areaFigures, fieldPlaceLine, IPHONE_MEASURE_STEPS, isApproximatePlace, measureMethodFor, restoredAreaDraft, type AreaDraft, type AreaDraftPoint, type AreaFigures, type AreaMethod, type AreaMode } from '@lilachat/shared';
import { EvidenceInput } from '../ServiceDriveWeb';
import type { PickerHandle } from '../../../chat/camera/cameraRequests';
import { fieldPointNow } from '../observations/ObservationFormsWeb';

/**
 * An additional area measured in the field (José 12/11, option B). On an
 * iPhone, Apple's «Medición» measures: Lilachat says each step, computes the
 * m² and keeps what was typed while the person is in Medición (iOS may reload
 * the app on the way back); the picture of the measurement comes from Fotos.
 * Elsewhere the figures are typed and the photo is taken with the camera.
 */
export type MeasuredArea = { entryId: string; figures: AreaFigures; method: AreaMethod; place: string; note: string; point: AreaDraftPoint | null; photos: File[] };
type Props = { serviceId: string; iphone: boolean; reading: Promise<AreaDraftPoint | null>; busy?: boolean; line?: string | null; onSave: (area: MeasuredArea) => Promise<boolean> };
type TextField = 'length' | 'width' | 'area' | 'thickness' | 'place' | 'note';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';
const FIELD = 'h-14 w-full rounded-xl border border-outline/20 bg-background px-3 text-lg font-semibold';
const MODES: { key: AreaMode; label: string }[] = [{ key: 'sides', label: 'Largo × ancho' }, { key: 'direct', label: 'Área total' }];

function readDraft(serviceId: string): AreaDraft | null {
  try {
    return restoredAreaDraft(JSON.parse(localStorage.getItem(areaDraftKey(serviceId)) ?? 'null'), Date.now());
  } catch {
    return null;
  }
}

function writeDraft(serviceId: string, draft: AreaDraft | null): void {
  try {
    if (draft) localStorage.setItem(areaDraftKey(serviceId), JSON.stringify(draft));
    else localStorage.removeItem(areaDraftKey(serviceId));
  } catch {
    // A private window keeps nothing: the person types again, nothing else depends on it.
  }
}

const freshDraft = (): AreaDraft => ({ entryId: crypto.randomUUID(), mode: 'sides', length: '', width: '', area: '', thickness: '', place: '', note: '', point: null, savedAt: Date.now() });

/** What was typed and the place, saved at each change; the GPS is read once unless the draft already has it. */
function useAreaDraft(serviceId: string, reading: Promise<AreaDraftPoint | null>) {
  const [draft, setDraft] = useState<AreaDraft>(() => readDraft(serviceId) ?? freshDraft());
  const [locating, setLocating] = useState(draft.point === null);
  const forgotten = useRef(false);
  const locate = useCallback(async (next: Promise<AreaDraftPoint | null>) => {
    setLocating(true);
    const point = await next;
    setLocating(false);
    if (point) setDraft((current) => ({ ...current, point }));
  }, []);
  const hadPoint = useRef(draft.point !== null);
  useEffect(() => {
    if (!hadPoint.current) void locate(reading);
  }, [locate, reading]);
  useEffect(() => {
    if (!forgotten.current) writeDraft(serviceId, { ...draft, savedAt: Date.now() });
  }, [serviceId, draft]);
  return {
    draft, locating,
    change: (field: TextField, value: string) => setDraft((current) => ({ ...current, [field]: value })),
    mode: (mode: AreaMode) => setDraft((current) => ({ ...current, mode })),
    relocate: () => void locate(fieldPointNow()),
    forget: () => {
      forgotten.current = true;
      writeDraft(serviceId, null);
    },
  };
}

/** The photos picked, with their previews freed when they go. */
function usePhotos() {
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const add = (file: File | undefined) => file && setPhotos((current) => [...current, { file, url: URL.createObjectURL(file) }]);
  const remove = (index: number) => setPhotos((current) => current.filter((one, at) => {
    if (at === index) URL.revokeObjectURL(one.url);
    return at !== index;
  }));
  return { photos, add, remove };
}

/** Step by step: what to open, how to measure, and how to come back. */
export function IphoneMeasureGuide() {
  return (
    <ol data-testid="guia-medicion" className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      {IPHONE_MEASURE_STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">{index + 1}</span>
          <div>
            <p className="font-semibold">{step.title}</p>
            <p className="text-sm text-on-surface-variant">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function NumberInput(props: { testId: string; label: string; unit: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className={KICKER}>{props.label}</span>
      <input data-testid={props.testId} inputMode="decimal" autoComplete="off" placeholder={`0,00 ${props.unit}`} value={props.value} onChange={(event) => props.onChange(event.target.value)} className={FIELD} />
    </label>
  );
}

/** Largo × ancho or the total area, the optional thickness, and what Lilachat computes from them. */
function Figures(props: { draft: AreaDraft; figures: AreaFigures | null; onMode: (mode: AreaMode) => void; onChange: (field: TextField, value: string) => void }) {
  const { draft } = props;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-variant p-1">
        {MODES.map((mode) => <button key={mode.key} type="button" data-testid={`modo-area-${mode.key}`} aria-pressed={draft.mode === mode.key} onClick={() => props.onMode(mode.key)} className={`h-11 rounded-lg text-sm font-bold ${draft.mode === mode.key ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}>{mode.label}</button>)}
      </div>
      {draft.mode === 'sides' ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberInput testId="area-largo" label="Largo" unit="m" value={draft.length} onChange={(value) => props.onChange('length', value)} />
          <NumberInput testId="area-ancho" label="Ancho" unit="m" value={draft.width} onChange={(value) => props.onChange('width', value)} />
        </div>
      ) : <NumberInput testId="area-total" label="Área" unit="m²" value={draft.area} onChange={(value) => props.onChange('area', value)} />}
      <NumberInput testId="area-espesor" label="Espesor (opcional)" unit="cm" value={draft.thickness} onChange={(value) => props.onChange('thickness', value)} />
      <p data-testid="area-calculada" className="rounded-xl bg-surface-variant px-3 py-3 text-center font-mono text-base font-bold">{props.figures ? props.figures.line : draft.mode === 'sides' ? 'Escribe el largo y el ancho en metros' : 'Escribe el área en m²'}</p>
    </div>
  );
}

function PhotoStrip(props: { iphone: boolean; photos: { url: string }[]; onAdd: (file: File | undefined) => void; onRemove: (index: number) => void }) {
  const input = useRef<PickerHandle>(null);
  return (
    <div className="space-y-2">
      <p className={KICKER}>{props.iphone ? 'Captura de Medición' : 'Foto del área'}</p>
      <div className="flex flex-wrap gap-2">
        {props.photos.map((photo, index) => (
          <div key={photo.url} data-testid={`area-foto-${index}`} className="relative h-24 w-24 overflow-hidden rounded-xl border border-outline/20">
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Quitar" onClick={() => props.onRemove(index)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-surface/90"><X size={14} /></button>
          </div>
        ))}
        <button type="button" data-testid="area-foto" onClick={() => input.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-primary px-1 text-center text-xs font-bold text-primary">
          {props.iphone ? <ImagePlus size={20} /> : <Camera size={20} />} {props.iphone ? 'Captura de Medición' : 'Tomar foto'}
        </button>
      </div>
      <EvidenceInput ref={input} testId="area-foto-entrada" kind="photo" fromLibrary={props.iphone} onFile={props.onAdd} />
    </div>
  );
}

function PlaceLine(props: { point: AreaDraftPoint | null; locating: boolean; onRetry: () => void }) {
  const approximate = isApproximatePlace(props.point?.precision);
  const tone = props.point && !approximate ? 'text-primary' : approximate ? 'text-warning' : 'text-error';
  return (
    <div className="flex items-center justify-between gap-2">
      <p data-testid="area-gps" className={`text-sm font-semibold ${tone}`}>{props.point ? fieldPlaceLine(props.point.precision) : props.locating ? 'Buscando GPS…' : 'Sin GPS'}</p>
      {(!props.point || approximate) && !props.locating ? <button type="button" onClick={props.onRetry} className="flex h-11 items-center gap-1 text-sm font-semibold text-primary"><LocateFixed size={16} /> Leer el GPS de nuevo</button> : null}
    </div>
  );
}

/** «Nueva área»: the guide, the figures with their m² live, the photo, the place, and «Guardar área» at the bottom. */
export function AreaMeasureForm(props: Props) {
  const area = useAreaDraft(props.serviceId, props.reading);
  const shots = usePhotos();
  const [guideOpen, setGuideOpen] = useState(props.iphone);
  const [confirming, setConfirming] = useState(false);
  const figures = areaFigures(area.draft);
  const save = async () => {
    if (!figures) return;
    if (figures.large && !confirming) return setConfirming(true);
    const saved = await props.onSave({ entryId: area.draft.entryId, figures, method: measureMethodFor(props.iphone), place: area.draft.place.trim(), note: area.draft.note.trim(), point: area.draft.point, photos: shots.photos.map((one) => one.file) });
    if (saved) area.forget();
  };
  const label = confirming && figures ? `¿Seguro? ${figures.line.split(' = ').pop()}` : 'Guardar área';
  return (
    <section data-testid="nueva-area" className="space-y-4">
      {guideOpen ? <IphoneMeasureGuide /> : <button type="button" data-testid="ver-guia-medicion" onClick={() => setGuideOpen(true)} className="flex h-11 items-center gap-2 text-sm font-semibold text-primary"><Ruler size={16} /> Cómo medir con el iPhone</button>}
      <Figures draft={area.draft} figures={figures} onMode={(mode) => { area.mode(mode); setConfirming(false); }} onChange={(field, value) => { area.change(field, value); setConfirming(false); }} />
      <PhotoStrip iphone={props.iphone} photos={shots.photos} onAdd={shots.add} onRemove={shots.remove} />
      <PlaceLine point={area.draft.point} locating={area.locating} onRetry={area.relocate} />
      <input data-testid="area-ubicacion" value={area.draft.place} onChange={(event) => area.change('place', event.target.value)} maxLength={120} placeholder="Dónde está (opcional)" className="h-12 w-full rounded-xl border border-outline/20 bg-background px-3 text-base" />
      <textarea data-testid="area-nota" value={area.draft.note} onChange={(event) => area.change('note', event.target.value)} maxLength={300} placeholder="Por qué es adicional (opcional)" className="min-h-[72px] w-full rounded-xl border border-outline/20 bg-background p-3 text-base" />
      <div className="sticky bottom-0 -mx-4 space-y-1 border-t border-outline/10 bg-surface px-4 pb-4 pt-3">
        <button type="button" data-testid="guardar-area" disabled={!figures || !shots.photos.length || props.busy} onClick={() => void save()} className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-on-primary disabled:opacity-50 ${confirming ? 'bg-warning' : 'bg-primary'}`}><CheckCircle2 size={18} /> {label}</button>
        {props.line ? <p data-testid="guardar-area-nota" className="text-center text-sm text-on-surface-variant">{props.line}</p> : null}
      </div>
    </section>
  );
}
