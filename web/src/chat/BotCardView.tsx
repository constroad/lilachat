import { useContext, useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { cardActionLayout, cardContextOf, formatClock, isOrderCard, type BotCard, type CardAccent, type CardAction, type CardActionStyle, type CardTone } from '@lilachat/shared';
import { BotBlocksView } from './botBlocks/BotBlocksView';
import { BotCardDetail } from './botBlocks/BotCardDetail';
import { CardCommandContext, OrderCardContext, useCardCommand } from './botBlocks/cardCommand';
import { TONE as BLOCK_TONE } from './botBlocks/tones';

/** The status pill's tone (design `e-21`): background faint, border at 30 %, text strong. */
export const TONE: Record<CardTone, string> = {
  ok: 'border-en-linea/30 bg-en-linea/10 text-en-linea',
  warn: 'border-warning/30 bg-warning/10 text-warning',
  error: 'border-error/30 bg-error/10 text-error',
  info: 'border-primary/30 bg-primary/10 text-primary',
  neutral: 'border-outline/30 bg-background text-on-surface-variant',
};
/** The bar on top (Stitch a10): the space's brand or a tone; never a color of the message. */
const ACCENT_BAR = (accent: CardAccent): string => (accent === 'brand' ? 'bg-primary-brand' : BLOCK_TONE[accent].bar);
const ACTION: Record<CardActionStyle, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'border border-outline/25 text-on-surface hover:bg-background',
  danger: 'border border-error/30 text-error hover:bg-error/5',
};

/**
 * Kicker, status, title (a link when the whole card is one) and subtitle; every text wraps, none is
 * cut. The status rides the kicker's line (Stitch gst-01): beside the title it squeezed it (José 13/11). In a
 * narrow thread the pieces wrap into a second line, never squeeze the kicker («GAS / TO», José 13/11 night).
 */
function CardHead({ card }: { card: BotCard }) {
  return (
    <>
      {card.kicker || card.updatedAt || card.status ? (
        <div data-testid="tarjeta-cabecera" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 flex-auto break-words text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{card.kicker}</p>
          {card.updatedAt ? <span data-testid="tarjeta-actualizada" className="shrink-0 text-[10px] text-on-surface-variant">Actualizado {formatClock(card.updatedAt)}</span> : null}
          {card.status ? <span data-testid="tarjeta-estado" className={`max-w-[60%] rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TONE[card.status.tone]}`}>{card.status.label}</span> : null}
        </div>
      ) : null}
      {card.url ? (
        <a data-testid="tarjeta-titulo" href={card.url} target="_blank" rel="noopener noreferrer" className="break-words text-[15px] font-bold leading-5 hover:underline">{card.title}</a>
      ) : <p className="break-words text-[15px] font-bold leading-5">{card.title}</p>}
      {card.subtitle ? <p data-testid="tarjeta-subtitulo" className="-mt-1 break-words text-[13px] text-on-surface-variant">{card.subtitle}</p> : null}
    </>
  );
}

/** The link as text, or (Stitch a10) the footer line with the solid button on its right. */
function CardLink({ card }: { card: BotCard }) {
  const { link, footer } = card;
  if (link?.style === 'button' || (footer && link)) {
    return (
      <div data-testid="tarjeta-pie" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-outline/10 pt-2.5">
        {footer ? <p className="min-w-0 flex-1 break-words text-[12px] text-on-surface-variant">{footer}</p> : <span />}
        {link ? (
          <a href={link.url} target="_blank" rel="noopener noreferrer" className={link.style === 'button' ? 'inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-on-primary hover:opacity-90' : 'inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline'}>
            {link.label} {link.style === 'button' ? <ChevronRight size={15} /> : <ExternalLink size={13} />}
          </a>
        ) : null}
      </div>
    );
  }
  if (footer) return <p data-testid="tarjeta-pie" className="break-words border-t border-outline/10 pt-2.5 text-[12px] text-on-surface-variant">{footer}</p>;
  if (!link) return null;
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
      {link.label} <ExternalLink size={13} />
    </a>
  );
}

type SentAction = { id: string; state: 'sending' | 'sent' } | null;

/**
 * The buttons: side by side, or (Stitch gst-01) the one primary across the card with the others as
 * text under it — «Completar gasto» and «Descartar».
 */
function CardButtons(props: { actions: CardAction[]; sent: SentAction; onPress: (action: CardAction) => void }) {
  const { actions, sent } = props;
  const stacked = cardActionLayout(actions) === 'stacked';
  const classOf = (action: CardAction) => {
    if (!stacked) return `min-h-9 flex-auto whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${ACTION[action.style]}`;
    return action.style === 'primary' ? 'h-11 w-full rounded-xl bg-primary px-4 text-[15px] font-bold text-on-primary hover:opacity-90' : 'h-9 w-full rounded-lg px-4 text-[13px] font-semibold text-on-surface-variant hover:bg-background';
  };
  return (
    <div data-testid={stacked ? 'tarjeta-acciones-apiladas' : undefined} className={`border-t border-outline/10 px-3.5 ${stacked ? 'flex flex-col gap-1 pb-1.5 pt-3' : 'flex flex-wrap gap-2 py-2.5'}`}>
      {actions.map((action) => (
        <button key={action.id} type="button" data-testid={`accion-tarjeta-${action.id}`} disabled={sent !== null} onClick={() => props.onPress(action)} className={`disabled:opacity-60 ${classOf(action)}`}>
          {sent?.id === action.id ? (sent.state === 'sending' ? 'Enviando…' : 'Enviado ✓') : action.label}
        </button>
      ))}
    </div>
  );
}

/** A tap on the body of a card with `url` opens it; a button, a link or a command row keeps its own tap. */
function openCardUrl(url: string | undefined, target: EventTarget) {
  if (!url || (target instanceof Element && target.closest('a, button, [role="button"], input, textarea'))) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * A bot's card in the chat (`specs/BOTS-API.spec.md` §b; design `e-21`):
 * kicker, title, status, fields, a link and up to three actions. A tap goes to
 * the bot as `button.click`; the bot answers by closing the card (PATCH), so
 * after the tap the buttons only say it was sent. A button with a `command`
 * runs its line instead, and the card stays open: its form can be closed.
 */
export function BotCardView(props: { card: BotCard; chatId: string; seq: number; jwt: string }) {
  const { card } = props;
  const [sent, setSent] = useState<SentAction>(null);
  const [error, setError] = useState('');
  // The kit (§118.4): the detail opens over the window with the data that came with the message.
  const [detailOpen, setDetailOpen] = useState(false);
  const run = useCardCommand();
  const openOrder = useContext(OrderCardContext);
  const runRow = run ? (line: string) => run(line, props.seq, cardContextOf(card) ?? undefined) : null;
  const tap = async (actionId: string) => {
    setSent({ id: actionId, state: 'sending' });
    setError('');
    const response = await fetch(`/api/chats/${props.chatId}/card-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ seq: props.seq, action_id: actionId }) }).catch(() => null);
    if (response?.ok) return setSent({ id: actionId, state: 'sent' });
    const data = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
    setSent(null);
    setError(data.message ?? 'No se pudo enviar. Revisa tu conexión.');
  };
  const press = (action: CardAction) => (action.command ? runRow?.(action.command) : void tap(action.id));
  const actions = card.actions?.filter((action) => !action.command || runRow) ?? [];
  return (
    <CardCommandContext.Provider value={runRow}>
    <div data-testid="tarjeta-bot" onClick={(event) => openCardUrl(card.url, event.target)} className={`mb-1 w-[calc(100%-0.5rem)] max-w-sm overflow-hidden rounded-xl border border-outline/15 bg-surface text-on-surface ${card.url ? 'cursor-pointer' : ''}`}>
      {card.accent ? <div data-testid="tarjeta-acento" aria-hidden className={`h-[3px] ${ACCENT_BAR(card.accent)}`} /> : null}
      <div className="space-y-2 px-3.5 py-3">
        <CardHead card={card} />
        {card.fields.length ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
            {card.fields.map((field) => (
              <div key={`${field.label}-${field.value}`} className="min-w-0">
                <dt className="text-[11px] text-on-surface-variant">{field.label}</dt>
                <dd className="break-words font-semibold">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {card.blocks ? <BotBlocksView blocks={card.blocks} /> : null}
        {card.detail ? (
          <button type="button" data-testid="tarjeta-ver-detalle" onClick={() => setDetailOpen(true)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-outline/20 px-3 text-[13px] font-semibold hover:bg-background">
            Ver detalle <ChevronRight size={14} className="text-on-surface-variant" />
          </button>
        ) : null}
        {openOrder && props.seq && isOrderCard(card) ? (
          <button type="button" data-testid="tarjeta-ver-pedido" onClick={() => openOrder(props.seq)} className="inline-flex min-h-9 items-center gap-1 self-start rounded-full border border-outline/20 px-3 text-[13px] font-semibold text-on-surface hover:bg-background">
            Ver despachos y fotos <ChevronRight size={14} className="text-on-surface-variant" />
          </button>
        ) : null}
        <CardLink card={card} />
      </div>
      {actions.length ? <CardButtons actions={actions} sent={sent} onPress={press} /> : null}
      {error ? <p role="alert" className="border-t border-outline/10 px-3.5 py-2 text-[12px] text-error">{error}</p> : null}
      {detailOpen ? <BotCardDetail card={card} onClose={() => setDetailOpen(false)} /> : null}
    </div>
    </CardCommandContext.Provider>
  );
}
