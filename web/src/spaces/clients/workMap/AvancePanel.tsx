import { useState } from 'react';
import { CircleCheck, MousePointerClick, Ruler } from 'lucide-react';
import { AVANCE_MANUAL_HINT, AVANCE_MANUAL_LABEL, AVANCE_MANUAL_ONE, manualRangeSummary, type ManualRange, AVANCE_FOOTER, AVANCE_PERCENTS, AVANCE_PICK_STREET, avanceEndFor, avanceKicker, avanceProgressLine, metersLabel, runAvanceSave, stationLabel, type AvanceEntryIds, type ByApproveProgress, type AvancePercent, type AvanceTarget, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';
import { UndoProgress } from './PendingProgress';
import type { ManualMarks } from './AvanceMode';

const FIELD = 'mt-2 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 font-mono text-[15px] outline-none focus:border-primary';
const newIds = (): AvanceEntryIds => ({ scope: crypto.randomUUID(), progress: crypto.randomUUID() });
const metersOrNull = (text: string): number | null => (text.trim() === '' ? null : Number(text.replace(',', '.')));
type Answer = { ok: boolean; message: string } | null;

/** The five big buttons (design av-01): each one the street's share where the work arrives. */
function PercentButtons(props: { picked: AvancePercent | null; onPick: (percent: AvancePercent) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {AVANCE_PERCENTS.map((percent) => (
        <button key={percent} type="button" data-testid={`avance-pct-${percent}`} aria-pressed={props.picked === percent} onClick={() => props.onPick(percent)} className={`h-14 rounded-2xl text-[16px] font-bold ${props.picked === percent ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface hover:bg-outline/15'}`}>{percent} %</button>
      ))}
    </div>
  );
}

/** The street's head: kicker, name, length and what is already done. */
function StreetHead(props: { target: AvanceTarget }) {
  const progress = avanceProgressLine(props.target);
  return (
    <div>
      <p className={`${KICKER} font-mono`}>{avanceKicker(props.target)}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-xl font-extrabold text-on-surface">{props.target.streetName}</p>
        <p className="font-mono text-[15px] text-on-surface">{metersLabel(props.target.lengthM)}</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-outline/15"><div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} /></div>
      <div className="mt-1 flex justify-between font-mono text-[12px]">
        <span className="text-on-surface-variant">{progress.line}</span>
        <span className="font-bold text-primary">{progress.percent} % completado</span>
      </div>
      {props.target.pendingM !== null ? <p data-testid="avance-por-aprobar" className="mt-1 font-mono text-[12px] text-on-surface-variant">Por aprobar hasta {stationLabel(props.target.pendingM)}</p> : null}
    </div>
  );
}

/** The ends the person chose, the stable ids of this save and Portal's answer. */
function useAvanceSave(map: WorkMap, target: AvanceTarget, send: MapEditSend, range: ManualRange | null) {
  const [picked, setPicked] = useState<AvancePercent | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [ids, setIds] = useState(newIds);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const endM = typing ? metersOrNull(typed) : picked === null ? null : avanceEndFor(target, picked);
  const save = async () => {
    setBusy(true);
    const result = await runAvanceSave({ map, target, toM: endM, range, ids, now: new Date(), send });
    setBusy(false);
    setAnswer(result);
    if (result.ok) setIds(newIds());
  };
  const pick = (percent: AvancePercent) => { setAnswer(null); setTyping(false); setPicked(percent); };
  const type = (text: string) => { setAnswer(null); setTyped(text); };
  return { picked, typing, typed, endM, busy, answer, save, pick, type, openTyping: () => { setAnswer(null); setTyping((open) => !open); } };
}

/** «Modo Avance» in the panel (design av-01): street, bar, five buttons, the exact end and «Guardar avance». */
type UndoProps = { undoable: ByApproveProgress | null; onUndo: (id: string) => Promise<string | null> };

export function AvancePanel(props: { map: WorkMap; target: AvanceTarget | null; send: MapEditSend; /** «Marcar a mano» (José 28/11). */ manual?: ManualMarks } & Partial<UndoProps>) {
  if (!props.target) return <p data-testid="avance-panel-vacio" className="p-5 text-[14px] text-on-surface-variant">{AVANCE_PICK_STREET}</p>;
  return <AvanceStreet key={`${props.target.streetId}|${props.target.workId}`} map={props.map} target={props.target} send={props.send} undoable={props.undoable ?? null} onUndo={props.onUndo} manual={props.manual} />;
}

/** «Marcar a mano»: the stretch marked with two taps, or what to tap next. */
function ManualRow(props: { manual: ManualMarks }) {
  const { manual } = props;
  return (
    <div className="space-y-1">
      <button type="button" data-testid="avance-a-mano" aria-pressed={manual.on} onClick={manual.toggle} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold text-primary ${manual.on ? 'border-primary bg-primary/10' : 'border-outline/25'}`}><MousePointerClick size={16} />{AVANCE_MANUAL_LABEL}</button>
      {manual.on ? <p data-testid="avance-a-mano-tramo" className="text-center font-mono text-[13px] text-on-surface">{manual.range ? manualRangeSummary(manual.range) : manual.marks.length ? AVANCE_MANUAL_ONE : AVANCE_MANUAL_HINT}</p> : null}
    </div>
  );
}

function AvanceStreet(props: { map: WorkMap; target: AvanceTarget; send: MapEditSend; undoable: ByApproveProgress | null; onUndo?: (id: string) => Promise<string | null>; manual?: ManualMarks }) {
  const save = useAvanceSave(props.map, props.target, props.send, props.manual?.range ?? null);
  const manualOn = Boolean(props.manual?.on);
  return (
    <div data-testid="avance-panel" className="space-y-4 p-4 md:p-5">
      <StreetHead target={props.target} />
      {manualOn ? null : <PercentButtons picked={save.typing ? null : save.picked} onPick={save.pick} />}
      <div className={manualOn ? 'hidden' : undefined}>
        <button type="button" data-testid="avance-progresiva" aria-expanded={save.typing} onClick={save.openTyping} className="flex h-11 w-full items-center justify-center gap-2 font-mono text-[13px] text-primary"><Ruler size={16} />Hasta una progresiva exacta · {stationLabel(save.endM ?? 0)}</button>
        {save.typing ? <input data-testid="avance-progresiva-m" type="number" inputMode="decimal" min={0} autoFocus aria-label="Hasta (m)" placeholder="Hasta (m)" value={save.typed} onChange={(event) => save.type(event.target.value)} className={FIELD} /> : null}
      </div>
      {props.manual ? <ManualRow manual={props.manual} /> : null}
      {save.answer ? <p role="alert" data-testid="avance-respuesta-modo" className={`text-[13px] font-semibold ${save.answer.ok ? 'text-primary' : 'text-error'}`}>{save.answer.message}</p> : null}
      {props.undoable && props.undoable.toM !== null && props.onUndo ? <UndoProgress id={props.undoable.id} toM={props.undoable.toM} onUndo={props.onUndo} /> : null}
      <button type="button" data-testid="avance-guardar" disabled={save.busy} onClick={() => void save.save()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-on-primary disabled:opacity-60"><CircleCheck size={20} />{save.busy ? 'Guardando…' : 'Guardar avance'}</button>
      <p className="text-center text-[12px] text-on-surface-variant">{AVANCE_FOOTER}</p>
    </div>
  );
}
