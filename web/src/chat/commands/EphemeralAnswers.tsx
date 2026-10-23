import { X } from 'lucide-react';
import type { EphemeralAnswer } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { BotCardView } from '../BotCardView';

/**
 * What an app answered only to me (§c-bis), like Slack's «Only visible to
 * you»: never stored, gone on reload. A card here has no actions: there is no
 * message behind it.
 */
export function EphemeralAnswers(props: { answers: readonly EphemeralAnswer[]; onDismiss: (commandId: string) => void; chatId: string; jwt: string }) {
  if (props.answers.length === 0) return null;
  return (
    <div data-testid="respuestas-efimeras" className="mb-2 flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
      {props.answers.map((answer) => (
        <div key={answer.commandId} data-testid={`efimera-${answer.state}`} className="rounded-xl border border-outline/15 bg-background px-3 pb-2.5 pt-2">
          <div className="flex items-center gap-2">
            <Avatar name={answer.appName} size={22} bot />
            <p className="text-[14px] font-semibold text-on-surface">{answer.appName}</p>
            <p className="min-w-0 flex-1 truncate text-[12px] text-on-surface-variant">
              {answer.command ? `/${answer.command} · ` : ''}Solo tú ves esto
            </p>
            <button type="button" data-testid="btn-descartar-efimera" aria-label="Descartar" onClick={() => props.onDismiss(answer.commandId)} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface">
              <X size={16} />
            </button>
          </div>
          {answer.state === 'pending' ? <p className="mt-1 text-[14px] italic text-on-surface-variant">{answer.appName} está trabajando…</p> : null}
          {answer.state === 'failed' ? <p role="alert" className="mt-1 text-[14px] text-error">{answer.message}</p> : null}
          {answer.response?.text ? <p className="mt-1 whitespace-pre-wrap text-[14px] text-on-surface">{answer.response.text}</p> : null}
          {answer.response?.card ? (
            <div className="mt-2">
              <BotCardView card={{ ...answer.response.card, actions: [] }} chatId={props.chatId} seq={0} jwt={props.jwt} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
