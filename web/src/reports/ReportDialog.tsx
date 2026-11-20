import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  REPORT_NOTE_MAX,
  REPORT_NOTE_PLACEHOLDER,
  REPORT_REASONS,
  REPORT_SEND_LABEL,
  REPORT_SENT_TITLE,
  REPORT_SHEET_HINT,
  alsoBlockLabel,
  canSendReport,
  reportSentBody,
  reportSheetTitle,
  type ReportReason,
  type ReportSubject,
} from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { sendReport } from './reportApi';

type Sent = { blocked: boolean };

/**
 * «Denunciar» (Google Play, José 19/11): the reasons, an optional note and
 * «Bloquear también», then «Recibimos tu denuncia». Same dialog for a message
 * (from its menu) and for a person (from their card).
 */
export function ReportDialog(props: { jwt: string; subject: ReportSubject; personName: string; onClose: () => void; onBlocked?: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const result = await sendReport(props.jwt, { ...props.subject, reason, note: note.trim(), alsoBlock });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.data.blocked) props.onBlocked?.();
    setSent({ blocked: result.data.blocked });
  };

  if (sent) return <ReportSent blocked={sent.blocked} onClose={props.onClose} />;
  const footer = (
    <button type="button" data-testid="denuncia-enviar" disabled={!canSendReport(reason, note) || busy} onClick={() => void submit()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-error text-sm font-semibold text-on-primary disabled:opacity-50">
      {busy ? <Loader2 size={16} className="animate-spin" /> : null}
      {REPORT_SEND_LABEL}
    </button>
  );
  return (
    <Overlay title={reportSheetTitle(props.subject.target, props.personName)} onClose={props.onClose} footer={footer}>
      <p className="text-[13px] text-on-surface-variant">{REPORT_SHEET_HINT}</p>
      <fieldset className="mt-3 flex flex-col gap-1" aria-label="Motivo">
        {REPORT_REASONS.map((option) => (
          <label key={option.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-background">
            <input type="radio" name="report-reason" data-testid={`denuncia-motivo-${option.id}`} checked={reason === option.id} onChange={() => setReason(option.id)} className="h-4 w-4 accent-primary" />
            {option.label}
          </label>
        ))}
      </fieldset>
      <textarea data-testid="denuncia-nota" value={note} maxLength={REPORT_NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder={REPORT_NOTE_PLACEHOLDER} rows={3} className="mt-3 w-full resize-none rounded-lg border border-outline/20 bg-surface p-3 text-sm outline-none focus:border-primary" />
      <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" data-testid="denuncia-bloquear" checked={alsoBlock} onChange={(event) => setAlsoBlock(event.target.checked)} className="h-4 w-4 accent-primary" />
        {alsoBlockLabel(props.personName)}
      </label>
      {error ? <p role="alert" className="mt-2 text-[13px] text-error">{error}</p> : null}
    </Overlay>
  );
}

function ReportSent({ blocked, onClose }: { blocked: boolean; onClose: () => void }) {
  const footer = (
    <button type="button" data-testid="denuncia-listo" onClick={onClose} className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-on-primary">
      Listo
    </button>
  );
  return (
    <Overlay title={REPORT_SENT_TITLE} onClose={onClose} footer={footer}>
      <div data-testid="denuncia-recibida" className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 size={40} className="text-primary" />
        <p className="mt-3 text-base font-semibold">{REPORT_SENT_TITLE}</p>
        <p className="mt-1 text-sm text-on-surface-variant">{reportSentBody(blocked)}</p>
      </div>
    </Overlay>
  );
}
