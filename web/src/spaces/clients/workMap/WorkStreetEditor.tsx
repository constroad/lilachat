import { lazy, Suspense, useMemo, useState } from 'react';
import { Save, Undo2, X } from 'lucide-react';
import { DRAW_MODES, EMPTY_STREET, metersLabel, setDrawMode, streetDraftEnds, streetDraftHint, streetDraftLengthM, streetDraftLines, streetDraftPins, streetDraftProblem, tapStreetDraft, undoStreetDraft, workMapView, type DrawMode, type StreetDraft, type TapFeatures, type WorkMap, type WorkMapPoint } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';
import type { StreetSend } from './workProgressSender';

const WorkMapCanvas = lazy(() => import('./WorkMapCanvas'));
const NO_STREETS: WorkMap = { streets: [], scopes: [], progress: [], works: [], stages: [] };
const FIELD = 'h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[15px] outline-none focus:border-primary';

type EditorProps = { title: string; map: WorkMap | null; send: StreetSend; onClose: () => void; onSaved: (message: string) => void };

/** Design o-02: tap the start, the bends and the end of a street; Portal measures and keeps it (José 07/11: everyone draws). */
export function WorkStreetEditor(props: EditorProps) {
  const [draft, setDraft] = useState(EMPTY_STREET);
  const [entryId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const view = useMemo(() => workMapView(props.map ?? NO_STREETS), [props.map]);
  const onTap = (point: WorkMapPoint, roads?: TapFeatures) => {
    const tapped = tapStreetDraft(draft, roads ?? { underFinger: [], nearby: [], tap: point });
    setDraft(tapped.draft);
    setError(tapped.problem);
  };
  const save = async () => {
    const problem = streetDraftProblem(draft);
    if (problem) return setError(problem);
    setSaving(true);
    const sent = await props.send(draft, entryId);
    setSaving(false);
    if (sent.ok) props.onSaved(sent.message);
    else setError(sent.message);
  };
  return (
    <div data-testid="editor-calle" className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-outline/15 bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className={`${KICKER} truncate text-primary`}>{props.title}</p>
          <h2 className="text-lg font-bold tracking-tight">Definir área de trabajo</h2>
        </div>
        <button type="button" data-testid="editor-calle-cerrar" aria-label="Cerrar" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={18} /></button>
      </header>
      <div className="bg-primary px-4 py-3 text-on-primary">
        <ModeSwitch mode={draft.mode} onMode={(mode) => { setError(null); setDraft((before) => setDrawMode(before, mode)); }} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p data-testid="editor-calle-ayuda" className="text-[14px] font-semibold">{streetDraftHint(draft)}</p>
          {draft.mode === 'hand' ? <span data-testid="editor-calle-puntos" className="shrink-0 rounded-md bg-on-primary/15 px-2 py-0.5 font-mono text-[11px]">{draft.points.length} puntos</span> : null}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" data-testid="editor-calle-deshacer" disabled={!draft.points.length} onClick={() => { setError(null); setDraft(undoStreetDraft); }} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-on-primary/15 text-[14px] font-semibold disabled:opacity-50"><Undo2 size={16} />Deshacer</button>
          <button type="button" data-testid="editor-calle-cancelar" onClick={props.onClose} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-on-primary/15 text-[14px] font-semibold"><X size={16} />Cancelar</button>
        </div>
      </div>
      <div className="relative min-h-[320px] flex-1">
        <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-surface-variant" />}>
          <WorkMapCanvas view={view} expanded={false} pins={streetDraftPins(draft)} stretches={streetDraftLines(draft)} onTap={onTap} />
        </Suspense>
      </div>
      <StreetFields draft={draft} onChange={(change) => { setError(null); setDraft((before) => ({ ...before, ...change })); }} />
      <div className="border-t border-outline/15 bg-surface px-4 pb-4">
        {error ? <p data-testid="editor-calle-error" role="alert" className="pt-2 text-[13px] font-semibold text-error">{error}</p> : null}
        <button type="button" data-testid="editor-calle-guardar" disabled={saving} onClick={() => void save()} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-60"><Save size={18} />{saving ? 'Guardando…' : 'Guardar calle'}</button>
      </div>
    </div>
  );
}

/** «Tocar la calle» first: it is the fast one (audit 07/11). «A mano» is for a pasaje the map lacks. */
function ModeSwitch({ mode, onMode }: { mode: DrawMode; onMode: (mode: DrawMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Cómo dibujar" className="grid grid-cols-2 gap-1 rounded-xl bg-on-primary/15 p-1">
      {DRAW_MODES.map((one) => (
        <button key={one.mode} type="button" role="radio" aria-checked={mode === one.mode} data-testid={`editor-modo-${one.mode}`} onClick={() => onMode(one.mode)} className={`h-9 rounded-lg text-[13px] font-semibold ${mode === one.mode ? 'bg-surface text-primary' : ''}`}>{one.label}</button>
      ))}
    </div>
  );
}

function StreetFields({ draft, onChange }: { draft: StreetDraft; onChange: (change: Partial<StreetDraft>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-outline/15 bg-surface px-4 pt-3">
      <label className="col-span-2 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Nombre
        <input data-testid="editor-calle-nombre" value={draft.name} maxLength={80} placeholder="Jr. Los Pinos" onChange={(event) => onChange({ name: event.target.value })} className={`${FIELD} mt-1 normal-case tracking-normal text-on-surface`} />
      </label>
      <div className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Largo
        <p data-testid="editor-calle-largo" className="mt-1 flex h-11 items-center font-mono text-[15px] normal-case text-on-surface">{metersLabel(streetDraftLengthM(draft))}</p>
        {streetDraftEnds(draft) ? <p data-testid="editor-calle-extremos" className="font-mono text-[11px] normal-case tracking-normal text-on-surface-variant">{streetDraftEnds(draft)}</p> : null}
      </div>
      <label className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Ancho (m)
        <input data-testid="editor-calle-ancho" type="number" inputMode="decimal" min={0.1} max={60} step={0.1} value={draft.widthM ?? ''} placeholder="6.0" onChange={(event) => onChange({ widthM: event.target.value === '' ? null : Number(event.target.value) })} className={`${FIELD} mt-1 normal-case tracking-normal text-on-surface`} />
      </label>
    </div>
  );
}
