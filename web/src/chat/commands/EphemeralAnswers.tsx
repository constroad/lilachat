import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, EyeOff, Send, X } from 'lucide-react';
import { canCloseAll, ephemeralLabel, ephemeralSummary, openAnswerId, toggleAnswer, type EphemeralAnswer, type StackChoice } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { BotCardView } from '../BotCardView';
import { LinkedText } from '../LinkedText';

type Props = { answers: readonly EphemeralAnswer[]; onDismiss: (commandId: string) => void; onShare?: (commandId: string) => Promise<string | null>; onOpenForm?: (commandId: string) => void; chatId: string; jwt: string };

/**
 * What an app answered only to me (§c-bis), like Slack's «Only visible to
 * you»: never stored, gone on reload. Since pending 104 (José, 28/10, design
 * c-01) a stack of chips like Claude's: the newest open, the rest folded in
 * one line, each with its X and «Cerrar todas» on top. A card here has no
 * actions: there is no message behind it. In a channel, «Enviar al canal» has
 * the app post it there.
 */
export function EphemeralAnswers(props: Props) {
  const [choice, setChoice] = useState<StackChoice>({ open: null, newest: null });
  if (props.answers.length === 0) return null;
  const openId = openAnswerId(props.answers, choice);
  return (
    <div data-testid="respuestas-efimeras" className="mb-2 flex max-h-[45vh] flex-col">
      <div className="flex h-8 items-center gap-1.5 text-on-surface-variant">
        <EyeOff size={14} />
        <p className="flex-1 text-[11px] font-bold uppercase tracking-widest">{`Solo tú ves esto · ${props.answers.length}`}</p>
        {canCloseAll(props.answers) ? (
          <button type="button" data-testid="btn-cerrar-todas-efimeras" onClick={() => props.answers.forEach((answer) => props.onDismiss(answer.commandId))} className="text-[13px] font-semibold text-primary hover:underline">
            Cerrar todas
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {props.answers.map((answer) => (
          <div key={answer.commandId} data-testid={`efimera-${answer.state}`} className="rounded-xl border border-outline/15 bg-background px-3">
            <AnswerHead answer={answer} open={answer.commandId === openId} onToggle={() => setChoice((current) => toggleAnswer(props.answers, current, answer.commandId))} onDismiss={() => props.onDismiss(answer.commandId)} />
            {answer.commandId === openId ? <AnswerBody answer={answer} {...props} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One line: logo, app, the /command and, folded, what it said; the chevron opens or folds it, the X dismisses it. */
function AnswerHead(props: { answer: EphemeralAnswer; open: boolean; onToggle: () => void; onDismiss: () => void }) {
  const { answer } = props;
  const label = ephemeralLabel(answer);
  return (
    <div className="flex min-h-[44px] items-center gap-2">
      <button type="button" data-testid={`efimera-plegar-${answer.commandId}`} aria-expanded={props.open} onClick={props.onToggle} className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left">
        {answer.avatarUrl ? <AppLogo avatarUrl={answer.avatarUrl} size={22} rounded="rounded-md" /> : <Avatar name={answer.appName} size={22} bot />}
        <span className="shrink-0 text-[14px] font-semibold text-on-surface">{answer.appName}</span>
        {label ? <span className={`shrink-0 text-[13px] text-primary ${answer.action ? 'font-semibold' : 'font-mono'}`}>{label}</span> : null}
        <span className={`min-w-0 flex-1 truncate text-[13px] ${answer.state === 'failed' ? 'text-error' : 'text-on-surface-variant'}`}>{props.open ? '' : ephemeralSummary(answer)}</span>
        {props.open ? <ChevronUp size={16} className="shrink-0 text-on-surface-variant" /> : <ChevronDown size={16} className="shrink-0 text-on-surface-variant" />}
      </button>
      <button type="button" data-testid="btn-descartar-efimera" aria-label="Descartar" onClick={props.onDismiss} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface">
        <X size={16} />
      </button>
    </div>
  );
}

function AnswerBody(props: Props & { answer: EphemeralAnswer }) {
  const { answer } = props;
  return (
    <div className="border-t border-outline/10 pb-2.5 pt-2">
      {answer.state === 'pending' ? (
        <p data-testid="efimera-pensando" className="flex items-center gap-2 text-[14px] italic text-on-surface-variant">
          <span aria-hidden className="inline-flex gap-1">
            {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${dot * 0.15}s` }} />)}
          </span>
          {answer.appName} está trabajando…
        </p>
      ) : null}
      {answer.state === 'failed' ? <p role="alert" className="text-[14px] text-error">{answer.message}</p> : null}
      {answer.state === 'form' && props.onOpenForm ? (
        <button type="button" data-testid="btn-abrir-formulario" onClick={() => props.onOpenForm!(answer.commandId)} className="flex h-9 items-center gap-1.5 rounded-lg border border-outline/25 px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">
          <ClipboardList size={14} /> Abrir «{answer.response?.form?.title}»
        </button>
      ) : null}
      {answer.response?.text ? <p className="whitespace-pre-wrap break-words text-[14px] text-on-surface"><LinkedText text={answer.response.text} own={false} /></p> : null}
      {answer.response?.card ? (
        <div className="mt-2">
          <BotCardView card={{ ...answer.response.card, actions: [] }} chatId={props.chatId} seq={0} jwt={props.jwt} />
        </div>
      ) : null}
      {/* shareable:false (R160): a debt or a salary is only for whoever asked. */}
      {props.onShare && answer.state === 'answered' && answer.response?.shareable !== false ? <ShareAnswer onShare={() => props.onShare!(answer.commandId)} /> : null}
    </div>
  );
}

function ShareAnswer(props: { onShare: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true);
    const reason = await props.onShare();
    setBusy(false);
    setError(reason ?? '');
  };
  return (
    <div className="mt-2 flex items-center gap-3">
      {error ? <p role="alert" className="min-w-0 flex-1 text-[13px] text-error">{error}</p> : <p className="min-w-0 flex-1 text-[12px] italic text-on-surface-variant">Los demás no lo ven</p>}
      <button type="button" data-testid="btn-enviar-al-canal" disabled={busy} onClick={() => void send()} className="flex h-9 items-center gap-1.5 rounded-lg border border-outline/25 px-3 text-[13px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
        <Send size={14} /> {busy ? 'Enviando…' : 'Enviar al canal'}
      </button>
    </div>
  );
}
