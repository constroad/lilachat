import { useContext, useState, type ReactNode } from 'react';
import { Camera, Check, ChevronRight, CircleCheck, Copy, ExternalLink, FileText, ImagePlus, ListChecks, Map as MapIcon, MapPin, type LucideIcon } from 'lucide-react';
import { cardActionLayout, cardContextOf, visitBlocksOf, visitCardActionOf, visitKickerParts, formatClock, isOrderCard, viewableLinkOf, type BotCard, type CardAccent, type CardAction, type CardActionStyle, type CardTone, type VisitCardAction } from '@lilachat/shared';
import { BotBlocksView } from './botBlocks/BotBlocksView';
import { BotCardDetail } from './botBlocks/BotCardDetail';
import { CardCommandContext, OpenServiceContext, OrderCardContext, useCardCommand } from './botBlocks/cardCommand';
import { TONE as BLOCK_TONE } from './botBlocks/tones';
import { copiarTexto } from './copiarTexto';
import { QuoteEmbedWeb } from './QuoteEmbedWeb';
import { usePortalFileViewer } from '../spaces/clients/PortalFileViewer';
import { InVisitCardContext, VisitActionContext } from '../spaces/visits/visitActionContext';
import { VisitText } from '../spaces/visits/VisitCardBlocks';

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
/** lv01: «VISITA TÉCNICA ·» in the accent, the visit's code in mono grey. */
function VisitKicker({ kicker }: { kicker: string }) {
  const { lead, code } = visitKickerParts(kicker);
  return (
    <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
      {lead}{code ? <span className="font-mono font-semibold tracking-normal text-on-surface-variant">{code}</span> : null}
    </p>
  );
}

function CardHead({ card, visit }: { card: BotCard; visit: boolean }) {
  return (
    <>
      {card.kicker || card.updatedAt || card.status ? (
        <div data-testid="tarjeta-cabecera" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {visit ? <VisitKicker kicker={card.kicker ?? ''} /> : <p className="min-w-0 flex-auto break-words text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{card.kicker}</p>}
          {card.updatedAt && !visit ? <span data-testid="tarjeta-actualizada" className="shrink-0 text-[10px] text-on-surface-variant">Actualizado {formatClock(card.updatedAt)}</span> : null}
          {card.status ? <span data-testid="tarjeta-estado" className={`max-w-[60%] border px-2 py-0.5 text-[10px] font-bold uppercase ${visit ? `rounded-md ${TONE.neutral}` : `rounded-full ${TONE[card.status.tone]}`}`}>{card.status.label}</span> : null}
        </div>
      ) : null}
      {card.url ? (
        <a data-testid="tarjeta-titulo" href={card.url} target="_blank" rel="noopener noreferrer" className="break-words text-[15px] font-bold leading-5 hover:underline">{card.title}</a>
      ) : <p className={`break-words font-bold ${visit ? 'text-[18px] leading-6' : 'text-[15px] leading-5'}`}>{card.title}</p>}
      {card.subtitle && visit ? (
        <p data-testid="tarjeta-subtitulo" className="-mt-1 flex items-start gap-1.5 text-[13px] text-on-surface-variant"><MapPin size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span data-testid="visita-direccion" className="min-w-0 truncate">{card.subtitle}</span></p>
      ) : card.subtitle ? <p data-testid="tarjeta-subtitulo" className="-mt-1 break-words text-[13px] text-on-surface-variant">{card.subtitle}</p> : null}
    </>
  );
}

/** A card's link: a file (a quote's PDF) opens in Lilachat's viewer (José 13/11); a page, in a new tab. */
function LinkOut(props: { link: NonNullable<BotCard['link']>; className: string; children: ReactNode }) {
  const viewer = usePortalFileViewer();
  const file = viewableLinkOf(props.link);
  if (!file) return <a href={props.link.url} target="_blank" rel="noopener noreferrer" className={props.className}>{props.children}</a>;
  return (
    <>
      <button type="button" data-testid="tarjeta-archivo" onClick={() => viewer.open(file)} className={props.className}>{props.children}</button>
      {viewer.viewer}
    </>
  );
}

/** «Copiar enlace» beside a card's link (José 20/11): the same clipboard the chat uses elsewhere. */
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copiarTexto(url)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <button type="button" data-testid="tarjeta-copiar-enlace" onClick={() => void copy()} aria-label={copied ? 'Enlace copiado' : 'Copiar enlace'} title={copied ? 'Enlace copiado' : 'Copiar enlace'} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline/25 text-on-surface-variant hover:bg-background">
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
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
          <div className="flex items-center gap-2">
            <LinkOut link={link} className={link.style === 'button' ? 'inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-on-primary hover:opacity-90' : 'inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline'}>
              {link.label} {link.style === 'button' ? <ChevronRight size={15} /> : <ExternalLink size={13} />}
            </LinkOut>
            <CopyLinkButton url={link.url} />
          </div>
        ) : null}
      </div>
    );
  }
  if (footer) return <p data-testid="tarjeta-pie" className="break-words border-t border-outline/10 pt-2.5 text-[12px] text-on-surface-variant">{footer}</p>;
  if (!link) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <LinkOut link={link} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
        {link.label} <ExternalLink size={13} />
      </LinkOut>
      <CopyLinkButton url={link.url} />
    </div>
  );
}

/** lv01 has no clock on the kicker line: a visit card says when it changed beside who changed it. */
const withUpdateInFooter = (card: BotCard): BotCard => (card.footer && card.updatedAt ? { ...card, footer: `${card.footer} · ${formatClock(card.updatedAt)}` } : card);

type SentAction = { id: string; state: 'sending' | 'sent' } | null;

/** lv01: each visit button with its icon; «Terminar» in the online tone. */
const VISIT_ICON: Record<VisitCardAction, { icon: LucideIcon; tone: string }> = {
  point: { icon: Camera, tone: '' },
  interview: { icon: ListChecks, tone: 'text-primary' },
  photo: { icon: ImagePlus, tone: 'text-primary' },
  finish: { icon: CircleCheck, tone: 'text-en-linea' },
  pdf: { icon: FileText, tone: 'text-primary' },
  croquis: { icon: MapIcon, tone: 'text-primary' },
};

/** Four or more buttons two by two (Stitch lv01), 56 px tall, an odd last one across the card. */
function GridButtons(props: { actions: CardAction[]; sent: SentAction; onPress: (action: CardAction) => void }) {
  const { actions, sent } = props;
  return (
    <div data-testid="tarjeta-acciones-grilla" className="grid grid-cols-2 gap-2 border-t border-outline/10 px-3.5 py-3">
      {actions.map((action, index) => {
        const visit = visitCardActionOf(action.id);
        const Icon = visit ? VISIT_ICON[visit].icon : null;
        // An odd number: the first (the primary, «Marcar punto») across the card, the rest two by two.
        const wide = index === 0 && actions.length % 2 === 1 ? 'col-span-2' : '';
        const look = action.style === 'primary' ? 'bg-primary text-on-primary' : `border border-outline/25 bg-surface text-on-surface hover:bg-background`;
        return (
          <button key={action.id} type="button" data-testid={`accion-tarjeta-${action.id}`} disabled={sent !== null} onClick={() => props.onPress(action)} className={`flex min-h-[56px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-2 text-[13px] font-bold uppercase disabled:opacity-60 ${look} ${wide}`}>
            {Icon ? <Icon size={20} className={action.style === 'primary' ? '' : VISIT_ICON[visit!].tone} aria-hidden /> : null}
            <span>{sent?.id === action.id ? (sent.state === 'sending' ? 'Enviando…' : 'Enviado ✓') : action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The buttons: side by side, or (Stitch gst-01) the one primary across the card with the others as
 * text under it — «Completar gasto» and «Descartar».
 */
function CardButtons(props: { actions: CardAction[]; sent: SentAction; onPress: (action: CardAction) => void; grid?: boolean }) {
  const { actions, sent } = props;
  const layout = props.grid ? 'grid' : cardActionLayout(actions);
  if (layout === 'grid') return <GridButtons {...props} />;
  const stacked = layout === 'stacked';
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
/** `visitId`: a technical visit's card (lv01, agentes 14/11): its `visita_*` buttons open Lilachat's screens. */
/** What one tap on a card's row answers (`button.click`), outside the component to keep its own complexity down. */
function useCardActionTap(chatId: string, jwt: string, seq: number) {
  const [sent, setSent] = useState<SentAction>(null);
  const [error, setError] = useState('');
  const tap = async (actionId: string) => {
    setSent({ id: actionId, state: 'sending' });
    setError('');
    const response = await fetch(`/api/chats/${chatId}/card-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ seq, action_id: actionId }) }).catch(() => null);
    if (response?.ok) return setSent({ id: actionId, state: 'sent' });
    const data = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
    setSent(null);
    setError(data.message ?? 'No se pudo enviar. Revisa tu conexión.');
  };
  return { sent, error, tap };
}

type PressDeps = { openService?: ((serviceId: string) => void) | null; openQuoteEmbed: (quoteId: string) => void; openVisit?: ((visitId: string, action: VisitCardAction) => void) | null; visitId?: string; runRow: ((line: string) => void) | null; tap: (actionId: string) => void };

/** Where a tap on a card's action goes: an internal jump, Portal's editor embedded, a visit's screen, a line, or `button.click`. */
function pressOf(action: CardAction, deps: PressDeps): void {
  if (action.open?.route === 'service') return deps.openService?.(action.open.serviceId);
  if (action.open?.route === 'quote-embed') return deps.openQuoteEmbed(action.open.quoteId);
  const visitAction = deps.visitId && deps.openVisit ? visitCardActionOf(action.id) : null;
  if (visitAction) return deps.openVisit!(deps.visitId!, visitAction);
  return action.command ? deps.runRow?.(action.command) : deps.tap(action.id);
}

/** The card's own content: fields, blocks, the detail and order buttons, its link line. */
function CardBody(props: { card: BotCard; seq: number; visitId?: string; openOrder: ((seq: number) => void) | null; onShowDetail: () => void }) {
  const { card } = props;
  return (
    <div className="space-y-2 px-3.5 py-3">
      <CardHead card={card} visit={Boolean(props.visitId)} />
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
      {card.blocks ? <InVisitCardContext.Provider value={Boolean(props.visitId)}><BotBlocksView blocks={props.visitId ? visitBlocksOf(card.blocks).body : card.blocks} /></InVisitCardContext.Provider> : null}
      {card.detail ? (
        <button type="button" data-testid="tarjeta-ver-detalle" onClick={props.onShowDetail} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-outline/20 px-3 text-[13px] font-semibold hover:bg-background">
          Ver detalle <ChevronRight size={14} className="text-on-surface-variant" />
        </button>
      ) : null}
      {props.openOrder && props.seq && isOrderCard(card) ? (
        <button type="button" data-testid="tarjeta-ver-pedido" onClick={() => props.openOrder!(props.seq)} className="inline-flex min-h-9 items-center gap-1 self-start rounded-full border border-outline/20 px-3 text-[13px] font-semibold text-on-surface hover:bg-background">
          Ver despachos y fotos <ChevronRight size={14} className="text-on-surface-variant" />
        </button>
      ) : null}
      <CardLink card={props.visitId ? withUpdateInFooter(card) : card} />
    </div>
  );
}

/** What hangs under the card: a visit's missing sections, an error, the detail sheet or Portal's quote editor. */
function CardOverlays(props: { card: BotCard; visitId?: string; error: string; detailOpen: boolean; onCloseDetail: () => void; quoteEmbedId: string | null; onCloseQuoteEmbed: () => void; workspaceId?: string; chatId: string; jwt: string }) {
  const { card } = props;
  return (
    <>
      {props.visitId && card.blocks ? visitBlocksOf(card.blocks).missing.map((block, index) => <div key={`falta-${index}`} className="px-3.5 pb-3"><VisitText block={block} /></div>) : null}
      {props.error ? <p role="alert" className="border-t border-outline/10 px-3.5 py-2 text-[12px] text-error">{props.error}</p> : null}
      {props.detailOpen ? <BotCardDetail card={card} onClose={props.onCloseDetail} /> : null}
      {props.quoteEmbedId && props.workspaceId ? <QuoteEmbedWeb jwt={props.jwt} spaceId={props.workspaceId} chatId={props.chatId} quoteId={props.quoteEmbedId} onClose={props.onCloseQuoteEmbed} /> : null}
    </>
  );
}

export function BotCardView(props: { card: BotCard; chatId: string; seq: number; jwt: string; visitId?: string; /** `open: { route: 'quote-embed' }` (José via agentes 20/11): which space it asks the link to. */ workspaceId?: string }) {
  const { card } = props;
  const { sent, error, tap } = useCardActionTap(props.chatId, props.jwt, props.seq);
  const [quoteEmbedId, setQuoteEmbedId] = useState<string | null>(null);
  // The kit (§118.4): the detail opens over the window with the data that came with the message.
  const [detailOpen, setDetailOpen] = useState(false);
  const run = useCardCommand();
  const openOrder = useContext(OrderCardContext);
  const openService = useContext(OpenServiceContext);
  const runRow = run ? (line: string) => run(line, props.seq, cardContextOf(card) ?? undefined) : null;
  const openVisit = useContext(VisitActionContext);
  const press = (action: CardAction) => pressOf(action, { openService, openQuoteEmbed: setQuoteEmbedId, openVisit, visitId: props.visitId, runRow, tap: (id) => void tap(id) });
  const actions = card.actions?.filter((action) => (!action.command || runRow) && (!action.open || action.open.route === 'quote-embed' || openService)) ?? [];
  return (
    <CardCommandContext.Provider value={runRow}>
    <div data-testid="tarjeta-bot" onClick={(event) => openCardUrl(card.url, event.target)} className={`mb-1 w-[calc(100%-0.5rem)] max-w-sm overflow-hidden border border-outline/15 bg-surface text-on-surface ${props.visitId ? 'rounded-[10px]' : 'rounded-xl'} ${card.url ? 'cursor-pointer' : ''}`}>
      {card.accent ? <div data-testid="tarjeta-acento" aria-hidden className={`h-[3px] ${ACCENT_BAR(card.accent)}`} /> : null}
      <CardBody card={card} seq={props.seq} visitId={props.visitId} openOrder={openOrder} onShowDetail={() => setDetailOpen(true)} />
      {actions.length ? <CardButtons actions={actions} sent={sent} onPress={press} grid={Boolean(props.visitId)} /> : null}
      <CardOverlays card={card} visitId={props.visitId} error={error} detailOpen={detailOpen} onCloseDetail={() => setDetailOpen(false)} quoteEmbedId={quoteEmbedId} onCloseQuoteEmbed={() => setQuoteEmbedId(null)} workspaceId={props.workspaceId} chatId={props.chatId} jwt={props.jwt} />
    </div>
    </CardCommandContext.Provider>
  );
}
