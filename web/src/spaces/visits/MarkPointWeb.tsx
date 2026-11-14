import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Circle, CircleDot, Construction, Grid2x2, LocateFixed, MapPin, RotateCcw, Target, TreePine, TriangleAlert, Unplug, UtilityPole, Waves, X, type LucideIcon } from 'lucide-react';
import { pointProblem, VISIT_MEASURE_UNITS, VISIT_POINT_TYPES, type VisitDocument, type VisitPointDraft } from '@lilachat/shared';
import type { PickerHandle } from '../../chat/camera/cameraRequests';
import { stampOfFile } from '../../chat/camera/shotStamp';
import { RouteMapWeb } from '../../chat/botBlocks/RouteMapWeb';
import { EvidenceInput } from '../clients/ServiceDriveWeb';
import { prepared, type DriveFile } from '../clients/useDriveUpload';

type Place = { lat: number; lng: number; precisionM?: number };
type Shot = { file: DriveFile; preview: string };
type Props = { document: VisitDocument; n: number; onSave: (point: Omit<VisitPointDraft, 'lat' | 'lng'> & { lat?: number; lng?: number }, photo: DriveFile | null) => void; onClose: () => void };

const FIX_TIMEOUT_MS = 10_000;

/** A fresh reading of the browser, never its cached one. */
function readPlace(): Promise<Place | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, precisionM: Math.round(position.coords.accuracy) }), () => resolve(null), { enableHighAccuracy: true, timeout: FIX_TIMEOUT_MS, maximumAge: 0 });
  });
}

/** The camera first (Lilachat's on a phone, the picker on a computer), the GPS read beside it (lv02). */
function useShotAndPlace() {
  const input = useRef<PickerHandle>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const take = (file: File) => {
    const point = stampOfFile(file)?.point;
    if (point) setPlace({ lat: point.lat, lng: point.lng, precisionM: Math.round(point.precision) });
    void prepared(file).then(({ source }) => setShot({ file: source, preview: URL.createObjectURL(file) }));
  };
  const open = () => input.current?.click();
  useEffect(() => {
    open();
    void readPlace().then((found) => found && setPlace((known) => known ?? found));
    // Once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => void (shot && URL.revokeObjectURL(shot.preview)), [shot]);
  // The door of every photo (camera gate): Lilachat's camera with its stamp on a phone, a file on a computer.
  const picker = <EvidenceInput ref={input} testId="punto-archivo" kind="photo" title="Foto del punto" onFile={(file) => file && take(file)} />;
  return { shot, place, open, picker };
}

/** What «Guardar punto» sends: the measure only with a number, the note only when written. */
function draftOf(type: string, measure: string, unit: string, note: string, place: Place | null) {
  const value = Number(measure.replace(',', '.'));
  const hasMeasure = measure.trim() !== '' && Number.isFinite(value);
  return { type, ...(note.trim() ? { note: note.trim() } : {}), ...(hasMeasure ? { measure: value } : {}), ...(unit ? { unit } : {}), ...(place ?? {}) };
}

/** One line icon per Portal type, as lv02 draws them; «Otro» and anything new fall back to a pin. */
const TYPE_ICONS: Readonly<Record<string, LucideIcon>> = { GIBA: Construction, BUZON: CircleDot, TAPA_SERVICIO: Target, REJILLA: Grid2x2, BACHE: TriangleAlert, SARDINEL: Waves, ACCESO: MapPin, CABLE_AEREO: Unplug, POSTE: UtilityPole, ARBOL: TreePine, TUBERIA_EXPUESTA: Circle };

function TypeChips({ value, onChoose }: { value: string; onChoose: (type: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {VISIT_POINT_TYPES.map((option) => {
        const Icon = TYPE_ICONS[option.value] ?? MapPin;
        const chosen = option.value === value;
        return (
          <button key={option.value} type="button" data-testid={`punto-tipo-${option.value}`} aria-pressed={chosen} onClick={() => onChoose(option.value)} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[14px] font-semibold ${chosen ? 'bg-primary text-on-primary' : 'border border-outline/20 bg-surface text-on-surface'}`}>
            <Icon size={20} aria-hidden />{option.short}
          </button>
        );
      })}
    </div>
  );
}

function MeasureRow({ measure, unit, onMeasure, onUnit }: { measure: string; unit: string; onMeasure: (text: string) => void; onUnit: (unit: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input data-testid="punto-medida" value={measure} onChange={(event) => onMeasure(event.target.value)} inputMode="decimal" placeholder="Medida" className="min-h-[48px] w-28 rounded-xl border border-outline/20 bg-surface px-3 text-[15px] text-on-surface" />
      {VISIT_MEASURE_UNITS.map((option) => (
        <button key={option.value} type="button" data-testid={`punto-unidad-${option.value}`} onClick={() => onUnit(unit === option.value ? '' : option.value)} className={`min-h-[44px] min-w-[44px] rounded-xl px-3 text-[14px] ${unit === option.value ? 'bg-primary font-bold text-on-primary' : 'border border-outline/20 bg-surface text-on-surface'}`}>{option.label}</button>
      ))}
    </div>
  );
}

const STRIP = { width: 360, height: 150 };

/** The visit's points and the new one where the phone is (lv02), on the map; nothing to draw without either. */
function PointsStrip({ document, n, place }: { document: VisitDocument; n: number; place: Place | null }) {
  const saved = document.map.points.map((point) => ({ lat: point.lat, lng: point.lng, n: point.n }));
  const points = [...saved, ...(place ? [{ lat: place.lat, lng: place.lng, n }] : [])];
  if (!points.length) return null;
  return <div data-testid="punto-mapa" className="flex justify-center border-b border-outline/10 bg-surface py-3"><RouteMapWeb points={points} box={STRIP} numbered {...(place ? { current: points.length - 1 } : {})} /></div>;
}

/** «Marcar un punto» (design lv02): the photo, what it is, an optional measure and note, «Guardar punto N». */
export function MarkPointWeb(props: Props) {
  const { shot, place, open, picker } = useShotAndPlace();
  const [type, setType] = useState('');
  const [measure, setMeasure] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const draft = draftOf(type, measure, unit, note, place);
  const problem = pointProblem({ lat: Number.NaN, lng: Number.NaN, ...draft }, props.document);
  return (
    <div data-testid="marcar-punto" className="fixed inset-0 z-40 flex flex-col bg-background">
      {picker}
      <header className="flex items-center gap-2 border-b border-outline/10 px-3 py-2">
        <button type="button" data-testid="marcar-punto-cerrar" onClick={props.onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center"><X size={22} /></button>
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{`Visita · ${props.document.code}`}</p>
          <h2 className="text-[18px] font-bold text-on-surface">Marcar un punto</h2>
        </div>
        <span data-testid="punto-gps-estado" className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-bold uppercase ${place ? 'border-en-linea/30 bg-en-linea/10 text-en-linea' : 'border-outline/20 text-on-surface-variant'}`}><span className={`h-2 w-2 rounded-full ${place ? 'bg-en-linea' : 'bg-outline'}`} aria-hidden />{place ? 'GPS activo' : 'Buscando GPS'}</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="relative h-56 bg-surface-variant">
          {shot ? <img src={shot.preview} alt="Foto del punto" className="h-full w-full object-cover" /> : null}
          <span data-testid="punto-gps" className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 font-mono text-[12px] text-white"><LocateFixed size={14} className="text-en-linea" aria-hidden />{place ? `GPS ±${place.precisionM ?? '?'} m` : 'Buscando GPS…'}</span>
          <button type="button" data-testid="punto-foto" onClick={open} className="absolute right-3 top-3 flex min-h-[40px] items-center gap-1.5 rounded-lg bg-surface px-3 text-[14px] font-semibold text-primary">{shot ? <RotateCcw size={16} /> : <Camera size={16} />}{shot ? 'Repetir' : 'Tomar foto'}</button>
        </div>
        <PointsStrip document={props.document} n={props.n} place={place} />
        <div className="mx-auto flex max-w-[720px] flex-col gap-3 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Clasificación de campo</p>
              <p className="text-[16px] font-bold uppercase text-on-surface">¿Qué es?</p>
            </div>
            {type ? <span data-testid="punto-elegido" className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">1 elegido</span> : null}
          </div>
          <TypeChips value={type} onChoose={setType} />
          <MeasureRow measure={measure} unit={unit} onMeasure={setMeasure} onUnit={setUnit} />
          <input data-testid="punto-nota" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Nota (opcional)" className="min-h-[48px] rounded-xl border border-outline/20 bg-surface px-3 text-[15px] text-on-surface" />
        </div>
      </div>
      <footer className="mx-auto flex w-full max-w-[720px] flex-col gap-1 border-t border-outline/10 px-4 pb-4 pt-3">
        {problem && type ? <p data-testid="punto-problema" className="text-center text-[13px] text-on-surface-variant">{problem}</p> : null}
        <button type="button" data-testid="guardar-punto" disabled={Boolean(problem)} onClick={() => props.onSave(draft, shot?.file ?? null)} className="flex min-h-[72px] items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-on-primary disabled:opacity-50"><CheckCircle2 size={20} />{`Guardar punto ${props.n}`}</button>
      </footer>
    </div>
  );
}
