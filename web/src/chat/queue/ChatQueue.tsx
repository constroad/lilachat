import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { queueDetail, queueKicker, type QueueItem, type QueueKind } from '@lilachat/shared';
import { useChatQueue, type QueueAction } from './useChatQueue';

/** Each kind's tone (design `q-01-tarjetas-en-cola`): a late task in red; the rest, the accent. */
const KICKER_TONE: Record<QueueKind, string> = {
  task: 'border-error/30 bg-error/10 text-error',
  event: 'border-warning/30 bg-warning/10 text-warning',
  poll: 'border-primary/30 bg-primary/10 text-primary',
  reminder: 'border-primary/30 bg-primary/10 text-primary',
};

type Button = { label: string; action?: QueueAction; open?: boolean; dismiss?: boolean; primary?: boolean };

/** What each card offers: doing the thing, or opening its card in the chat. */
function buttonsOf(item: QueueItem): Button[] {
  if (item.kind === 'task') return [{ label: 'Marcar hecha', action: 'done', primary: true }, ...(item.canPostpone ? [{ label: 'Posponer 1 día', action: 'postpone' as const }] : [])];
  if (item.kind === 'event') return [{ label: 'Voy', action: 'yes', primary: true }, { label: 'No voy', action: 'no' }];
  if (item.kind === 'poll') return item.seq ? [{ label: 'Votar', open: true, primary: true }] : [];
  return [...(item.seq ? [{ label: 'Ver en el chat', open: true, primary: true }] : []), { label: 'Listo', dismiss: true }];
}

/**
 * The cards queued over the writing bar on the web (backlog 36, José 21/10:
 * like Claude's chips): one in front, the next ones peeking behind, «1 de N».
 */
export function ChatQueue(props: { jwt: string; chatId: string; onOpen: (seq: number) => void }) {
  const { visible, busy, act, dismiss } = useChatQueue(props.jwt, props.chatId);
  const [error, setError] = useState<string | null>(null);
  const item = visible[0];
  if (!item) return null;
  const detail = queueDetail(item, new Date());
  const late = item.kind === 'task' ? detail.slice(item.context.length + 3) : detail;
  const press = (button: Button) => {
    setError(null);
    if (button.open && item.seq) props.onOpen(item.seq);
    else if (button.dismiss) dismiss(item);
    else if (button.action) void act(item, button.action).then(setError);
  };
  return (
    <div data-testid="cola-del-chat" className="mx-3 mb-2">
      {visible.length > 2 ? <div className="mx-6 h-2 rounded-t-2xl border border-b-0 border-outline/15 bg-surface" /> : null}
      {visible.length > 1 ? <div className="mx-3 h-2 rounded-t-2xl border border-b-0 border-outline/15 bg-surface" /> : null}
      <div className="rounded-2xl border border-outline/15 bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${KICKER_TONE[item.kind]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {queueKicker(item.kind)}
          </span>
          <span className="flex-1" />
          {visible.length > 1 ? <span className="rounded-full border border-outline/20 px-2 py-0.5 text-[12px] text-on-surface-variant">{`1 de ${visible.length}`}</span> : null}
          <button type="button" data-testid="cola-descartar" aria-label="Descartar" title="Descartar" onClick={() => dismiss(item)} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <X size={16} />
          </button>
        </div>
        <button type="button" disabled={!item.seq} onClick={() => item.seq && props.onOpen(item.seq)} className="mt-2 block w-full text-left disabled:cursor-default">
          <span data-testid="cola-titulo" className="block truncate text-[15px] font-semibold">{item.title}</span>
          <span className="block truncate text-[13px] text-on-surface-variant">
            {item.kind === 'task' ? `${item.context} · ` : ''}
            <span className={item.kind === 'task' ? 'text-error' : ''}>{late}</span>
          </span>
        </button>
        {error ? <p role="alert" className="mt-2 text-[13px] text-error">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          {buttonsOf(item).map((button) => (
            <button key={button.label} type="button" data-testid={`cola-${button.action ?? (button.open ? 'abrir' : 'listo')}`} disabled={busy} onClick={() => press(button)} className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${button.primary ? 'flex-1 bg-primary text-on-primary' : 'border border-outline/25 bg-surface'}`}>
              {button.action === 'done' ? <Check size={16} /> : null}
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
