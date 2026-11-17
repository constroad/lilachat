import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { LOSS_REASONS, LOSS_REASON_LABEL, moneyOf, prospectNameOf, shownProspectPhone, type LossReason, type ProspectOutcome, type ProspectView } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { Kicker } from './daliParts';
import { sendChange, type ChangeOutcome } from './sellerDesk';

const NOTE_MAX = 500;

type Props = { jwt: string; spaceId: string; prospect: ProspectView; onDone: (outcome: ChangeOutcome) => void; onClose: () => void };

/** What the form asks before it can be saved: lost needs a reason, and «Otro» needs a word. */
function missingOf(outcome: ProspectOutcome | null, reason: LossReason | null, note: string): string {
  if (!outcome) return 'Elige si se ganó o se perdió.';
  if (outcome === 'lost' && !reason) return 'Elige por qué se perdió.';
  return outcome === 'lost' && reason === 'other' && !note.trim() ? 'Cuenta en una línea qué pasó.' : '';
}

/**
 * «Resultado» (dl-06 and dl-07): won or lost, and why it was lost, from the contract's reasons. What proves a sale is
 * the quote agentes linked (the amount only for an admin: the server strips it). Stitch's subtitles under each option,
 * the «too small» reason, Dali writing again in 30 days and the notice to Meta do not go (no source behind them yet).
 */
export function ResultDialog(props: Props) {
  const { prospect } = props;
  const [outcome, setOutcome] = useState<ProspectOutcome | null>(prospect.result?.outcome ?? null);
  const [reason, setReason] = useState<LossReason | null>(prospect.result?.reason ?? null);
  const [note, setNote] = useState(prospect.result?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const missing = missingOf(outcome, reason, note);
    if (missing || !outcome) return setError(missing);
    setBusy(true);
    const result = { outcome, ...(outcome === 'lost' && reason ? { reason } : {}), ...(note.trim() ? { note: note.trim() } : {}) };
    const answer = await sendChange(props.jwt, props.spaceId, prospect, { result });
    setBusy(false);
    if (!answer.ok && !answer.stale) return setError(answer.message);
    props.onDone(answer);
  };

  return (
    <Overlay
      title={`Resultado · ${prospectNameOf(prospect)}`}
      onClose={props.onClose}
      header={<><Kicker>Resultado</Kicker><h2 className="truncate text-lg font-extrabold tracking-tight">{prospectNameOf(prospect)}</h2><p className="truncate text-[13px] text-on-surface-variant">{[prospect.service?.name, shownProspectPhone(prospect.phone)].filter(Boolean).join(' · ')}</p></>}
      footer={<><FieldError>{error}</FieldError><PrimaryButton testId="guardar-resultado" disabled={busy} onClick={() => void save()}>Guardar resultado</PrimaryButton></>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <OutcomeButton outcome="won" chosen={outcome === 'won'} onPick={() => { setOutcome('won'); setError(''); }} />
          <OutcomeButton outcome="lost" chosen={outcome === 'lost'} onPick={() => { setOutcome('lost'); setError(''); }} />
        </div>
        {outcome === 'won' && prospect.quote ? <QuoteProof prospect={prospect} /> : null}
        {outcome === 'lost' ? (
          <section className="space-y-2">
            <Kicker>¿Por qué se perdió?</Kicker>
            <div className="grid grid-cols-2 gap-2">
              {LOSS_REASONS.map((one) => (
                <button key={one} type="button" data-testid={`motivo-${one}`} aria-pressed={reason === one} onClick={() => { setReason(one); setError(''); }} className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${reason === one ? 'border-primary bg-primary/5 text-primary' : 'border-outline/30 hover:bg-background'}`}>
                  <span className="truncate">{LOSS_REASON_LABEL[one]}</span>
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${reason === one ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_rgb(var(--c-surface))]' : 'border-outline/40'}`} />
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {outcome ? (
          <section className="space-y-2">
            <Kicker>{outcome === 'lost' && reason === 'other' ? '¿Qué pasó?' : '¿Algo más? (opcional)'}</Kicker>
            <textarea data-testid="nota-resultado" value={note} maxLength={NOTE_MAX} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="Un detalle para el equipo" className="w-full resize-none rounded-xl border border-outline/30 bg-surface px-3 py-2 text-sm" />
          </section>
        ) : null}
      </div>
    </Overlay>
  );
}

function OutcomeButton({ outcome, chosen, onPick }: { outcome: ProspectOutcome; chosen: boolean; onPick: () => void }) {
  const won = outcome === 'won';
  const tone = won ? 'border-en-linea bg-en-linea/10 text-en-linea' : 'border-error bg-error/10 text-error';
  return (
    <button type="button" data-testid={`resultado-${outcome}`} aria-pressed={chosen} onClick={onPick} className={`flex h-16 items-center gap-3 rounded-xl border-2 px-4 text-left ${chosen ? tone : 'border-outline/20 hover:bg-background'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${chosen ? (won ? 'bg-en-linea text-on-primary' : 'bg-error text-on-primary') : 'bg-surface-variant/60 text-on-surface-variant'}`}>{won ? <Check size={18} /> : <X size={18} />}</span>
      <span className="text-base font-bold">{won ? 'Ganado' : 'Perdido'}</span>
    </button>
  );
}

/** The quote agentes linked from Portal: what backs the sale. */
function QuoteProof({ prospect }: { prospect: ProspectView }) {
  const quote = prospect.quote!;
  return (
    <section data-testid="prueba-cotizacion" className="rounded-xl border border-outline/15 px-4 py-3">
      <Kicker>Lo que lo prueba</Kicker>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold">{quote.code}</span>
        {quote.amount !== undefined ? <span className="ml-auto text-sm font-bold tabular-nums">{quote.currency && quote.currency !== 'PEN' ? `${quote.currency} ${quote.amount.toFixed(2)}` : moneyOf(quote.amount)}</span> : null}
      </div>
      {quote.url ? <a href={quote.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold text-primary">Ver cotización</a> : null}
    </section>
  );
}
