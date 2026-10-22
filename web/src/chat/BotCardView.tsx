import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { BotCard, CardActionStyle, CardTone } from '@lilachat/shared';

/** The status pill's tone (design `e-21`): background faint, border at 30 %, text strong. */
const TONE: Record<CardTone, string> = {
  ok: 'border-en-linea/30 bg-en-linea/10 text-en-linea',
  warn: 'border-warning/30 bg-warning/10 text-warning',
  error: 'border-error/30 bg-error/10 text-error',
  info: 'border-primary/30 bg-primary/10 text-primary',
  neutral: 'border-outline/30 bg-background text-on-surface-variant',
};
const ACTION: Record<CardActionStyle, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'border border-outline/25 text-on-surface hover:bg-background',
  danger: 'border border-error/30 text-error hover:bg-error/5',
};

/**
 * A bot's card in the chat (`specs/BOTS-API.spec.md` §b; design `e-21`):
 * kicker, title, status, fields, a link and up to three actions. A tap goes to
 * the bot as `button.click`; the bot answers by closing the card (PATCH), so
 * after the tap the buttons only say it was sent.
 */
export function BotCardView(props: { card: BotCard; chatId: string; seq: number; jwt: string }) {
  const { card } = props;
  const [sent, setSent] = useState<{ id: string; state: 'sending' | 'sent' } | null>(null);
  const [error, setError] = useState('');
  const tap = async (actionId: string) => {
    setSent({ id: actionId, state: 'sending' });
    setError('');
    const response = await fetch(`/api/chats/${props.chatId}/card-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ seq: props.seq, action_id: actionId }) }).catch(() => null);
    if (response?.ok) return setSent({ id: actionId, state: 'sent' });
    const data = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
    setSent(null);
    setError(data.message ?? 'No se pudo enviar. Revisa tu conexión.');
  };
  return (
    <div data-testid="tarjeta-bot" className="mb-1 w-full max-w-sm overflow-hidden rounded-xl border border-outline/15 bg-surface text-on-surface">
      <div className="space-y-2 px-3.5 py-3">
        {card.kicker ? <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{card.kicker}</p> : null}
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[15px] font-bold leading-5">{card.title}</p>
          {card.status ? <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TONE[card.status.tone]}`}>{card.status.label}</span> : null}
        </div>
        {card.fields.length ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
            {card.fields.map((field) => (
              <div key={`${field.label}-${field.value}`} className="min-w-0">
                <dt className="text-[11px] text-on-surface-variant">{field.label}</dt>
                <dd className="truncate font-semibold">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {card.link ? (
          <a href={card.link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
            {card.link.label} <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
      {card.actions?.length ? (
        <div className="flex flex-wrap gap-2 border-t border-outline/10 px-3.5 py-2.5">
          {card.actions.map((action) => (
            <button key={action.id} type="button" data-testid={`accion-tarjeta-${action.id}`} disabled={sent !== null} onClick={() => void tap(action.id)} className={`h-9 flex-1 rounded-full px-3 text-[13px] font-semibold disabled:opacity-60 ${ACTION[action.style]}`}>
              {sent?.id === action.id ? (sent.state === 'sending' ? 'Enviando…' : 'Enviado ✓') : action.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p role="alert" className="border-t border-outline/10 px-3.5 py-2 text-[12px] text-error">{error}</p> : null}
    </div>
  );
}
