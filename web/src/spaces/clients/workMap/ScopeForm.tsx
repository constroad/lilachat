import { useState } from 'react';
import { Check, Plus, Save, X } from 'lucide-react';
import { labelProblem, scopeDraftProblem, sendWorkScope, sendWorkStage, sendWorkTag, toggleScopeWork, WORK_TAG_COLORS, workScopeRequest, workStageRequest, workTagRequest, type MapEditSend, type ScopeDraft, type WorkMap } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

const FIELD = 'h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[15px] outline-none focus:border-primary';
const CHIP = 'flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold';
const numberOrNull = (text: string): number | null => (text.trim() === '' ? null : Number(text.replace(',', '.')));

type NewLabelProps = { testId: string; placeholder: string; colors?: readonly string[]; onCreate: (name: string, color: string) => Promise<string | null> };

/** «Nueva etapa» / «Nuevo trabajo» right where they are picked (o-04, o-05): a name, and a color for a work. */
function NewLabel(props: NewLabelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(props.colors?.[0] ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    const problem = labelProblem(name);
    if (problem) return setError(problem);
    setBusy(true);
    const failure = await props.onCreate(name, color);
    setBusy(false);
    if (failure) return setError(failure);
    setOpen(false);
    setName('');
  };
  if (!open) return <button type="button" data-testid={`${props.testId}-nueva`} onClick={() => setOpen(true)} className={`${CHIP} border-dashed border-primary/40 text-primary`}><Plus size={14} />{props.placeholder}</button>;
  return (
    <div className="basis-full rounded-xl border border-outline/15 bg-background p-3">
      <input data-testid={`${props.testId}-nombre`} autoFocus value={name} maxLength={60} placeholder={props.placeholder} onChange={(event) => { setError(null); setName(event.target.value); }} className={FIELD} />
      {props.colors ? (
        <div role="radiogroup" aria-label="Color" className="mt-2 flex flex-wrap gap-2">
          {props.colors.map((one) => <button key={one} type="button" role="radio" aria-checked={color === one} aria-label={`Color ${one}`} data-testid={`${props.testId}-color-${one.slice(1)}`} onClick={() => setColor(one)} className="grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-primary" style={{ backgroundColor: one }}>{color === one ? <Check size={14} className="text-background" /> : null}</button>)}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-10 flex-1 rounded-xl border border-outline/20 text-[13px] font-semibold"><X size={14} className="mr-1 inline" />Cancelar</button>
        <button type="button" data-testid={`${props.testId}-crear`} disabled={busy} onClick={() => void create()} className="h-10 flex-1 rounded-xl bg-primary text-[13px] font-semibold text-on-primary disabled:opacity-60">{busy ? 'Creando…' : 'Crear'}</button>
      </div>
    </div>
  );
}

type FormProps = { map: WorkMap; streetId: string; lengthM: number; initial: ScopeDraft; scopeId?: string; send: MapEditSend; onDone: () => void };

/** «Agregar tramo» / edit a stretch (o-03): where it starts and ends, its works and its stage. */
export function ScopeForm(props: FormProps) {
  const { map } = props;
  const [draft, setDraft] = useState(props.initial);
  const [entryId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const change = (next: Partial<ScopeDraft>) => { setError(null); setDraft((before) => ({ ...before, ...next })); };
  const created = async (run: Promise<{ ok: boolean; message: string }>) => { const result = await run; return result.ok ? null : result.message; };
  const save = async () => {
    const problem = scopeDraftProblem(draft, props.lengthM);
    if (problem) return setError(problem);
    setSaving(true);
    const result = await props.send(workScopeRequest(map, props.streetId, draft, entryId, props.scopeId), sendWorkScope);
    setSaving(false);
    if (result.ok) props.onDone();
    else setError(result.message);
  };
  return (
    <div data-testid="tramo-formulario" className="rounded-xl border-[1.5px] border-primary/30 bg-surface p-4">
      <p className={KICKER}>{props.scopeId ? 'Editar tramo' : 'Nuevo tramo'}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="text-[12px] font-semibold uppercase text-on-surface-variant">Desde (m)<input data-testid="tramo-desde" type="number" inputMode="decimal" min={0} value={draft.fromM ?? ''} onChange={(event) => change({ fromM: numberOrNull(event.target.value) })} className={`${FIELD} mt-1 font-mono text-on-surface`} /></label>
        <label className="text-[12px] font-semibold uppercase text-on-surface-variant">Hasta (m)<input data-testid="tramo-hasta" type="number" inputMode="decimal" min={0} value={draft.toM ?? ''} onChange={(event) => change({ toM: numberOrNull(event.target.value) })} className={`${FIELD} mt-1 font-mono text-on-surface`} /></label>
      </div>
      <p className="mt-3 text-[12px] font-semibold uppercase text-on-surface-variant">Trabajos</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {map.works.map((work) => {
          const on = draft.workIds.includes(work.id);
          return <button key={work.id} type="button" aria-pressed={on} data-testid={`tramo-trabajo-${work.id}`} onClick={() => setDraft((before) => toggleScopeWork(before, work.id))} className={`${CHIP} ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 text-on-surface'}`}><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />{work.name}</button>;
        })}
        <NewLabel testId="trabajo" placeholder="Nuevo trabajo" colors={WORK_TAG_COLORS} onCreate={(name, color) => created(props.send(workTagRequest(name, color), sendWorkTag))} />
      </div>
      <p className="mt-3 text-[12px] font-semibold uppercase text-on-surface-variant">Etapa</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {[{ id: null, name: 'Sin etapa' }, ...map.stages].map((stage) => {
          const on = draft.stageId === stage.id;
          return <button key={stage.id ?? 'none'} type="button" aria-pressed={on} data-testid={`tramo-etapa-${stage.id ?? 'ninguna'}`} onClick={() => change({ stageId: stage.id })} className={`${CHIP} ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 text-on-surface'}`}>{stage.name}</button>;
        })}
        <NewLabel testId="etapa" placeholder="Nueva etapa" onCreate={(name) => created(props.send(workStageRequest(name), sendWorkStage))} />
      </div>
      {error ? <p data-testid="tramo-error" role="alert" className="mt-3 text-[13px] font-semibold text-error">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={props.onDone} className="h-11 flex-1 rounded-xl border border-outline/20 text-[14px] font-semibold">Cancelar</button>
        <button type="button" data-testid="tramo-guardar" disabled={saving} onClick={() => void save()} className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-60"><Save size={16} />{saving ? 'Guardando…' : 'Guardar tramo'}</button>
      </div>
    </div>
  );
}
