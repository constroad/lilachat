import { useState } from 'react';
import { ClipboardList, Send, X } from 'lucide-react';
import type { EphemeralAnswer } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { BotCardView } from '../BotCardView';
import { LinkedText } from '../LinkedText';

/**
 * What an app answered only to me (§c-bis), like Slack's «Only visible to
 * you»: never stored, gone on reload. A card here has no actions: there is no
 * message behind it. In a channel, «Enviar al canal» has the app post it there.
 */
export function EphemeralAnswers(props: { answers: readonly EphemeralAnswer[]; onDismiss: (commandId: string) => void; onShare?: (commandId: string) => Promise<string | null>; onOpenForm?: (commandId: string) => void; chatId: string; jwt: string }) {
  if (props.answers.length === 0) return null;
  return (
    <div data-testid="respuestas-efimeras" className="mb-2 flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
      {props.answers.map((answer) => (
        <div key={answer.commandId} data-testid={`efimera-${answer.state}`} className="rounded-xl border border-outline/15 bg-background px-3 pb-2.5 pt-2">
          <div className="flex items-center gap-2">
            {answer.avatarUrl ? <AppLogo avatarUrl={answer.avatarUrl} size={22} rounded="rounded-md" /> : <Avatar name={answer.appName} size={22} bot />}
            <p className="text-[14px] font-semibold text-on-surface">{answer.appName}</p>
            <p className="min-w-0 flex-1 truncate text-[12px] text-on-surface-variant">
              {answer.action ? `${answer.action} · ` : answer.command ? `/${answer.command} · ` : ''}Solo tú ves esto
            </p>
            <button type="button" data-testid="btn-descartar-efimera" aria-label="Descartar" onClick={() => props.onDismiss(answer.commandId)} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface">
              <X size={16} />
            </button>
          </div>
          {answer.state === 'pending' ? (
            <p data-testid="efimera-pensando" className="mt-1 flex items-center gap-2 text-[14px] italic text-on-surface-variant">
              <span aria-hidden className="inline-flex gap-1">
                {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${dot * 0.15}s` }} />)}
              </span>
              {answer.appName} está trabajando…
            </p>
          ) : null}
          {answer.state === 'failed' ? <p role="alert" className="mt-1 text-[14px] text-error">{answer.message}</p> : null}
          {answer.state === 'form' && props.onOpenForm ? (
            <button type="button" data-testid="btn-abrir-formulario" onClick={() => props.onOpenForm!(answer.commandId)} className="mt-2 flex h-9 items-center gap-1.5 rounded-lg border border-outline/25 px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">
              <ClipboardList size={14} /> Abrir «{answer.response?.form?.title}»
            </button>
          ) : null}
          {answer.response?.text ? <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-on-surface"><LinkedText text={answer.response.text} own={false} /></p> : null}
          {answer.response?.card ? (
            <div className="mt-2">
              <BotCardView card={{ ...answer.response.card, actions: [] }} chatId={props.chatId} seq={0} jwt={props.jwt} />
            </div>
          ) : null}
          {/* shareable:false (R160): a debt or a salary is only for whoever asked. */}
          {props.onShare && answer.state === 'answered' && answer.response?.shareable !== false ? <ShareAnswer onShare={() => props.onShare!(answer.commandId)} /> : null}
        </div>
      ))}
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
      <button type="button" data-testid="btn-enviar-al-canal" disabled={busy} onClick={() => void send()} className="flex h-9 items-center gap-1.5 rounded-lg border border-outline/25 px-3 text-[13px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
        <Send size={14} /> {busy ? 'Enviando…' : 'Enviar al canal'}
      </button>
      {error ? <p role="alert" className="text-[13px] text-error">{error}</p> : null}
    </div>
  );
}
