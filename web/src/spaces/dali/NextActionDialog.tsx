import { useMemo, useState } from 'react';
import { Calendar, Check, FileText, MapPin, MessageSquare, Phone, type LucideIcon } from 'lucide-react';
import { NEXT_ACTION_KINDS, NEXT_ACTION_LABEL, followUpSequenceOf, nextActionWhenOf, prospectNameOf, suggestNextAction, whenOptions, type NextActionKind, type ProspectView } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Kicker, TextButton } from './daliParts';
import { sendChange, type ChangeOutcome } from './sellerDesk';

const KIND_ICON: Record<NextActionKind, LucideIcon> = { call: Phone, whatsapp: MessageSquare, visit: MapPin, quote: FileText };
const LIMA_OFFSET_MS = -5 * 3_600_000;

/** «2026-11-18T09:00» (a datetime-local input) read as Lima time. */
function limaInputToIso(value: string): string | null {
  const parsed = Date.parse(`${value}:00.000Z`);
  return Number.isNaN(parsed) ? null : new Date(parsed - LIMA_OFFSET_MS).toISOString();
}
const isoToLimaInput = (iso: string): string => new Date(Date.parse(iso) + LIMA_OFFSET_MS).toISOString().slice(0, 16);

type Props = { jwt: string; spaceId: string; prospect: ProspectView; now: Date; onDone: (outcome: ChangeOutcome) => void; onClose: () => void };

/**
 * «Próxima acción» (dl-09): what Dali suggests from the rules, what you will do, when (Lima time), the reminder, and
 * where the follow-up sequence goes. It becomes a reminder for whoever does it. «Avisar también a» and the pills of the
 * sequence Stitch drew do not go: a step is done, is today or comes.
 */
export function NextActionDialog(props: Props) {
  const { prospect, now } = props;
  const suggestion = useMemo(() => suggestNextAction(prospect, now), [prospect, now]);
  const options = useMemo(() => whenOptions(now), [now]);
  const [kind, setKind] = useState<NextActionKind>(prospect.nextAction?.kind ?? suggestion?.kind ?? 'call');
  const [at, setAt] = useState<string>(prospect.nextAction?.at ?? suggestion?.at ?? options[0]!.at);
  const [picking, setPicking] = useState(false);
  const [remind, setRemind] = useState(true);
  const [note, setNote] = useState(prospect.nextAction?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const steps = followUpSequenceOf(prospect, now);

  const save = async (clear = false) => {
    if (!clear && Date.parse(at) < now.getTime() - 60_000) return setError('Esa hora ya pasó: elige otra.');
    setBusy(true);
    const outcome = await sendChange(props.jwt, props.spaceId, prospect, { next_action: clear ? null : { kind, at, remind, ...(note.trim() ? { note: note.trim() } : {}) } });
    setBusy(false);
    if (!outcome.ok && !outcome.stale) return setError(outcome.message);
    props.onDone(outcome);
  };

  return (
    <Overlay
      title={`Próxima acción · ${prospectNameOf(prospect)}`}
      onClose={props.onClose}
      header={<><Kicker className="text-primary">Próxima acción</Kicker><h2 className="truncate text-lg font-extrabold tracking-tight">{prospectNameOf(prospect)}</h2></>}
      footer={<>
        <FieldError>{error}</FieldError>
        <PrimaryButton testId="guardar-proxima-accion" disabled={busy} onClick={() => void save()}>Guardar próxima acción</PrimaryButton>
        {prospect.nextAction ? <div className="mt-1 flex justify-center"><TextButton testId="quitar-proxima-accion" tone="neutral" onClick={() => void save(true)}>Quitar la próxima acción</TextButton></div> : null}
      </>}
    >
      <div className="space-y-5">
        {suggestion ? <Suggested text={`${NEXT_ACTION_LABEL[suggestion.kind]} ${nextActionWhenOf(suggestion.at, now).toLowerCase()}.`} reason={suggestion.reason} onUse={() => { setKind(suggestion.kind); setAt(suggestion.at); setPicking(false); }} /> : null}
        <section className="space-y-2">
          <Kicker>Qué harás</Kicker>
          <div className="grid grid-cols-2 gap-2">
            {NEXT_ACTION_KINDS.map((one) => <Choice key={one} testId={`accion-${one}`} Icon={KIND_ICON[one]} label={NEXT_ACTION_LABEL[one]} chosen={kind === one} onPick={() => setKind(one)} />)}
          </div>
        </section>
        <section className="space-y-2">
          <Kicker>Cuándo</Kicker>
          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => <WhenButton key={option.key} testId={`cuando-${option.key}`} label={option.label} chosen={!picking && at === option.at} onPick={() => { setAt(option.at); setPicking(false); }} />)}
            <WhenButton testId="cuando-elegir" label={picking ? nextActionWhenOf(at, now) : 'Elegir fecha'} icon chosen={picking || !options.some((option) => option.at === at)} onPick={() => setPicking(true)} />
          </div>
          {picking ? <input data-testid="cuando-fecha" type="datetime-local" value={isoToLimaInput(at)} onChange={(event) => { const iso = limaInputToIso(event.target.value); if (iso) setAt(iso); }} className="h-11 w-full rounded-xl border border-outline/30 bg-surface px-3 text-sm" /> : null}
        </section>
        <label className="flex items-center gap-3 rounded-xl border border-outline/15 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Recordatorio</span>
            <span className="block text-[13px] text-on-surface-variant">Te avisa en Lilachat a esa hora</span>
          </span>
          <input data-testid="recordatorio-proxima" type="checkbox" checked={remind} onChange={(event) => setRemind(event.target.checked)} className="h-5 w-5 accent-[rgb(var(--c-primary))]" />
        </label>
        <textarea data-testid="nota-proxima" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="Nota para ti (opcional)" rows={2} className="w-full resize-none rounded-xl border border-outline/30 bg-surface px-3 py-2 text-sm" />
        {steps ? <Sequence steps={steps} /> : null}
      </div>
    </Overlay>
  );
}

function Suggested({ text, reason, onUse }: { text: string; reason: string; onUse: () => void }) {
  return (
    <section data-testid="dali-sugiere" className="rounded-xl border border-outline/15 bg-surface-variant/40 px-4 py-3 shadow-[inset_3px_0_0_rgb(var(--c-primary))]">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[12px] font-bold text-on-primary">D</span>
        <Kicker className="flex-1 text-primary">Dali sugiere</Kicker>
        <button type="button" data-testid="usar-sugerencia" onClick={onUse} className="h-8 rounded-lg border border-primary/30 px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">Usar sugerencia</button>
      </div>
      <p className="mt-2 text-sm leading-5"><span className="font-bold">{text}</span> {reason}</p>
    </section>
  );
}

function Choice({ Icon, label, chosen, onPick, testId }: { Icon: LucideIcon; label: string; chosen: boolean; onPick: () => void; testId: string }) {
  return (
    <button type="button" data-testid={testId} aria-pressed={chosen} onClick={onPick} className={`flex min-h-[56px] items-center gap-3 rounded-xl border px-3 py-2 text-left ${chosen ? 'border-primary bg-primary/5 text-primary' : 'border-outline/30 hover:bg-background'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${chosen ? 'bg-primary text-on-primary' : 'bg-surface-variant/60 text-on-surface-variant'}`}><Icon size={18} /></span>
      <span className="min-w-0 text-[14px] font-semibold leading-5">{label}</span>
    </button>
  );
}

function WhenButton({ label, chosen, onPick, icon, testId }: { label: string; chosen: boolean; onPick: () => void; icon?: boolean; testId: string }) {
  return (
    <button type="button" data-testid={testId} aria-pressed={chosen} onClick={onPick} className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${chosen ? 'border-primary bg-primary/5 text-primary' : 'border-outline/30 hover:bg-background'}`}>
      {icon ? <Calendar size={16} /> : null}
      <span className="truncate">{label}</span>
      {chosen && !icon ? <Check size={16} /> : null}
    </button>
  );
}

/** Where the follow-up of the quote goes (day 0 to 10): done, today or coming; a message always needs your OK. */
function Sequence({ steps }: { steps: NonNullable<ReturnType<typeof followUpSequenceOf>> }) {
  return (
    <section data-testid="secuencia-seguimiento" className="rounded-xl border border-outline/15 px-4 py-3">
      <Kicker>Secuencia de seguimiento</Kicker>
      <ol className="mt-2 space-y-1.5">
        {steps.map((step) => (
          <li key={step.day} className={`flex items-center gap-2 text-[13px] ${step.state === 'next' ? 'text-on-surface-variant' : ''}`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${step.state === 'done' ? 'bg-en-linea text-on-primary' : step.state === 'current' ? 'bg-primary text-on-primary' : 'border border-outline/40'}`}>{step.state === 'done' ? <Check size={12} /> : ''}</span>
            <span className="min-w-0 flex-1">{`Día ${step.day} · ${step.label}`}</span>
            {step.state === 'current' ? <span className="text-[11px] font-bold uppercase text-primary">Ahora</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
