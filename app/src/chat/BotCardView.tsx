import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, ChevronRight, Copy, ExternalLink, FileText } from 'lucide-react-native';
import { cardActionLayout, cardContextOf, formatClock, isOrderCard, reportCardTargetOf, viewableLinkOf, visitBlocksOf, visitCardActionOf, type BotCard, type CardAccent, type CardAction, type CardActionStyle, type CardTone } from '@lilachat/shared';
import { BASE_URL } from '../api/client';
import { useFileViewer } from '../spaces/clients/useFileViewer';
import { InVisitCardContext } from '../spaces/visits/visitCardContext';
import { VisitAddress, VisitKicker, VisitText } from '../spaces/visits/VisitCardBlocks';
import { VisitCardButtons } from '../spaces/visits/VisitCardButtons';
import { useColores } from '../ui/tema';
import { AccionesDeTarjetaContext, useAccionesDeTarjeta } from './accionesDeTarjeta';
import { BotBlocksView } from './botBlocks/BotBlocksView';
import { BotCardDetail } from './botBlocks/BotCardDetail';
import { TONE_COLOR } from './botBlocks/tones';
import { cardWidthOf } from './cardWidth';

/** A card of text only: narrower than one with blocks, and never thinner than this. */
const CARD_TEXT_WIDTH = 300;
const CARD_MIN_FILL = 240;
const ACCENT_HEIGHT = 3;

/** The status pill's tone (design `e-21`): background faint, border at 30 %, text strong. */
export const TONE: Record<CardTone, { pill: string; text: string }> = {
  ok: { pill: 'border-en-linea/30 bg-en-linea/10', text: 'text-en-linea' },
  warn: { pill: 'border-warning/30 bg-warning/10', text: 'text-warning' },
  error: { pill: 'border-error/30 bg-error/10', text: 'text-error' },
  info: { pill: 'border-primary/30 bg-primary/10', text: 'text-primary' },
  neutral: { pill: 'border-outline/30 bg-background', text: 'text-on-surface-variant' },
};
/** The bar on top (Stitch a10): the space's brand or a tone; never a color of the message. */
const ACCENT_COLOR = (accent: CardAccent) => (accent === 'brand' ? ('primary-brand' as const) : TONE_COLOR[accent]);
const ACTION: Record<CardActionStyle, { box: string; text: string }> = {
  primary: { box: 'bg-primary', text: 'text-on-primary' },
  secondary: { box: 'border border-outline/25', text: 'text-on-surface' },
  danger: { box: 'border border-error/30', text: 'text-error' },
};

/**
 * Kicker, status, title and subtitle; every text wraps, none is cut (Stitch a10). The status rides
 * the kicker's line (Stitch gst-01): beside the title it took half its width and «S/ 500.00 ·
 * Ferretería» broke into three lines (José 13/11).
 */
function CardHead({ card }: { card: BotCard }) {
  return (
    <>
      {card.kicker || card.updatedAt || card.status ? (
        <View testID="tarjeta-cabecera" className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {card.kicker ? <Text className="min-w-0 grow text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{card.kicker}</Text> : <View className="grow" />}
          {card.updatedAt ? <Text testID="tarjeta-actualizada" className="text-[10px] text-on-surface-variant">Actualizado {formatClock(card.updatedAt)}</Text> : null}
          {card.status ? (
            <View testID="tarjeta-estado" className={`max-w-[60%] rounded-full border px-2 py-0.5 ${TONE[card.status.tone].pill}`}>
              <Text className={`text-[10px] font-bold uppercase ${TONE[card.status.tone].text}`}>{card.status.label}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text className="text-[15px] font-bold leading-5 text-on-surface">{card.title}</Text>
      {card.subtitle ? <Text testID="tarjeta-subtitulo" className="-mt-1 text-[13px] text-on-surface-variant">{card.subtitle}</Text> : null}
    </>
  );
}

/** lv01's head: the kicker split in two, the stage in a square neutral pill, the title at 18 and the address with its pin. */
function VisitCardHead({ card }: { card: BotCard }) {
  return (
    <>
      <View testID="tarjeta-cabecera" className="flex-row items-center gap-2">
        <VisitKicker kicker={card.kicker} />
        {card.status ? (
          <View testID="tarjeta-estado" className={`rounded-md border px-2 py-0.5 ${TONE.neutral.pill}`}>
            <Text className={`text-[10px] font-bold uppercase ${TONE.neutral.text}`}>{card.status.label}</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-[18px] font-bold leading-6 text-on-surface">{card.title}</Text>
      {card.subtitle ? <VisitAddress text={card.subtitle} /> : null}
    </>
  );
}

/** lv01 has no clock on the kicker line: a visit card says when it changed beside who changed it. */
const withUpdateInFooter = (card: BotCard): BotCard => (card.footer && card.updatedAt ? { ...card, footer: `${card.footer} · ${formatClock(card.updatedAt)}` } : card);

/** «Copiar enlace» beside a card's link (José 20/11): the same clipboard the chat uses elsewhere. */
function CopyLinkButton({ url }: { url: string }) {
  const colors = useColores();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Pressable testID="tarjeta-copiar-enlace" onPress={() => void copy()} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-lg border border-outline/25">
      {copied ? <Check size={15} color={colors['on-surface-variant']} /> : <Copy size={15} color={colors['on-surface-variant']} />}
    </Pressable>
  );
}

/** The link as text, or (Stitch a10) the footer line with the solid button on its right. */
function CardLink({ card }: { card: BotCard }) {
  const colors = useColores();
  const { link, footer } = card;
  // José 13/11: a quote's «Ver PDF» opened the browser; a file link opens in Lilachat's viewer.
  const viewer = useFileViewer();
  const file = viewableLinkOf(link);
  const open = () => (file ? viewer.open(file) : link && void Linking.openURL(link.url));
  if (link?.style === 'button' || (footer && link)) {
    const solid = link?.style === 'button';
    return (
      <View testID="tarjeta-pie" className="flex-row flex-wrap items-center justify-between border-t border-outline/10 pt-2.5" style={{ gap: 8 }}>
        {footer ? <Text className="min-w-0 flex-1 text-[12px] text-on-surface-variant">{footer}</Text> : <View />}
        {link ? (
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable testID="tarjeta-enlace" accessibilityRole="link" onPress={open} className={solid ? 'min-h-[40px] flex-row items-center gap-1 rounded-lg bg-primary px-3.5' : 'flex-row items-center gap-1'}>
              <Text className={`text-[13px] font-semibold ${solid ? 'text-on-primary' : 'text-primary'}`}>{link.label}</Text>
              {solid ? <ChevronRight size={15} color={colors['on-primary']} /> : <ExternalLink size={13} color={colors.primary} />}
            </Pressable>
            <CopyLinkButton url={link.url} />
          </View>
        ) : null}
        {viewer.viewer}
      </View>
    );
  }
  if (footer) return <Text testID="tarjeta-pie" className="border-t border-outline/10 pt-2.5 text-[12px] text-on-surface-variant">{footer}</Text>;
  if (!link) return null;
  return (
    <>
      <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
        <Pressable testID="tarjeta-enlace" onPress={open} hitSlop={6} className="flex-row items-center gap-1 self-start">
          <Text className="text-[13px] font-semibold text-primary">{link.label}</Text>
          <ExternalLink size={13} color={colors.primary} />
        </Pressable>
        <CopyLinkButton url={link.url} />
      </View>
      {viewer.viewer}
    </>
  );
}

type SentAction = { id: string; state: 'sending' | 'sent' } | null;
const sentLabel = (action: CardAction, sent: SentAction) => (sent?.id === action.id ? (sent.state === 'sending' ? 'Enviando…' : 'Enviado ✓') : action.label);

/**
 * The buttons: side by side, or (Stitch gst-01) the one primary across the card with the others as
 * text under it — «Completar gasto» and «Descartar».
 */
function CardButtons(props: { buttons: CardAction[]; sent: SentAction; onPress: (action: CardAction) => void }) {
  const { buttons, sent } = props;
  const stacked = cardActionLayout(buttons) === 'stacked';
  const boxOf = (action: CardAction) => {
    if (!stacked) return `min-h-10 grow rounded-full px-3 ${ACTION[action.style].box}`;
    return action.style === 'primary' ? 'h-12 self-stretch rounded-xl bg-primary px-4' : 'h-10 self-stretch px-4';
  };
  const textOf = (action: CardAction) => (stacked && action.style !== 'primary' ? 'text-on-surface-variant' : ACTION[action.style].text);
  return (
    <View testID={stacked ? 'tarjeta-acciones-apiladas' : undefined} className={`border-t border-outline/10 px-3.5 ${stacked ? 'gap-1 pb-1.5 pt-3' : 'flex-row flex-wrap gap-2 py-2.5'}`}>
      {buttons.map((action) => (
        <Pressable key={action.id} testID={`accion-tarjeta-${action.id}`} disabled={sent !== null} onPress={() => props.onPress(action)} className={`items-center justify-center ${boxOf(action)} ${sent !== null ? 'opacity-60' : ''}`}>
          <Text numberOfLines={1} className={`${stacked && action.style === 'primary' ? 'text-[15px] font-bold' : 'text-[13px] font-semibold'} ${textOf(action)}`}>{sentLabel(action, sent)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * A card with `url` opens it from its body (Stitch a10); its buttons and command rows answer
 * first, since RN gives the tap to the innermost. Without `url` it is a plain view, not a disabled button.
 */
function CardBody(props: { url?: string; children: ReactNode }) {
  const { url } = props;
  if (!url) return <View className="gap-2 px-3.5 py-3">{props.children}</View>;
  return <Pressable testID="tarjeta-cuerpo" accessibilityRole="link" onPress={() => void Linking.openURL(url)} className="gap-2 px-3.5 py-3">{props.children}</Pressable>;
}

/** Between the head and the link: the fields, the blocks, «Ver detalle» and an order's «Ver despachos y fotos». */
function CardMiddle(props: { card: BotCard; visit: boolean; seq: number; onShowDetail: () => void }) {
  const { card, visit } = props;
  const colors = useColores();
  const { openOrderCard } = useAccionesDeTarjeta();
  return (
    <>
        {card.fields.length ? (
          <View className="flex-row flex-wrap">
            {card.fields.map((field) => (
              <View key={`${field.label}-${field.value}`} className="w-1/2 py-0.5 pr-2">
                <Text className="text-[11px] text-on-surface-variant">{field.label}</Text>
                <Text className="text-[13px] font-semibold text-on-surface">{field.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {card.blocks ? <InVisitCardContext.Provider value={visit}><BotBlocksView blocks={visit ? visitBlocksOf(card.blocks).body : card.blocks} /></InVisitCardContext.Provider> : null}
        {card.detail ? (
          <Pressable testID="tarjeta-ver-detalle" onPress={props.onShowDetail} className="min-h-[36px] flex-row items-center gap-1 self-start rounded-full border border-outline/20 px-3">
            <Text className="text-[13px] font-semibold text-on-surface">Ver detalle</Text>
            <ChevronRight size={14} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
        {openOrderCard && props.seq && isOrderCard(card) ? (
          <Pressable testID="tarjeta-ver-pedido" onPress={() => openOrderCard(props.seq)} className="min-h-[36px] flex-row items-center gap-1 self-start rounded-full border border-outline/20 px-3">
            <Text className="text-[13px] font-semibold text-on-surface">Ver despachos y fotos</Text>
            <ChevronRight size={14} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
    </>
  );
}

/** The card's buttons: a visit's grid or the row, and «Abrir informe» of a report card. */
function CardFoot(props: { buttons: CardAction[]; visit: boolean; sent: SentAction; onPress: (action: CardAction) => void; openReport: (() => void) | null }) {
  const { buttons, visit, sent, onPress } = props;
  return (
    <>
      {buttons.length && visit ? <VisitCardButtons actions={buttons} sent={sent} onPress={onPress} /> : null}
      {buttons.length && !visit ? <CardButtons buttons={buttons} sent={sent} onPress={onPress} /> : null}
      {props.openReport ? <OpenReportButton onPress={props.openReport} /> : null}
    </>
  );
}

/** What one tap on a card's row answers (`button.click`): the card only says it was sent. */
function useCardActionTap(chatId: string, jwt: string, seq: number) {
  const [sent, setSent] = useState<SentAction>(null);
  const [error, setError] = useState('');
  const tap = async (actionId: string) => {
    setSent({ id: actionId, state: 'sending' });
    setError('');
    const response = await fetch(`${BASE_URL}/api/chats/${chatId}/card-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ seq, action_id: actionId }) }).catch(() => null);
    if (response?.ok) return setSent({ id: actionId, state: 'sent' });
    const data = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
    setSent(null);
    setError(data.message ?? 'No se pudo enviar. Revisa tu conexión.');
  };
  return { sent, error, tap };
}

/** «Abrir informe» under an «INFORME» card: the report itself, over the service's Informes (José 25/11). */
function OpenReportButton({ onPress }: { onPress: () => void }) {
  const colors = useColores();
  return (
    <View className="border-t border-outline/10 p-2">
      <Pressable testID="tarjeta-abrir-informe" accessibilityRole="button" onPress={onPress} className="h-11 flex-row items-center justify-center gap-2 rounded-lg bg-primary">
        <FileText size={16} color={colors['on-primary']} />
        <Text className="text-[14px] font-semibold text-on-primary">Abrir informe</Text>
      </Pressable>
    </View>
  );
}

/**
 * A bot's card in the chat (`specs/BOTS-API.spec.md` §b; design `e-21`), like
 * the web's: kicker, title, status, fields, link and up to three actions. A
 * tap reaches the bot as `button.click`; the bot closes the card, so after the
 * tap the buttons only say it was sent.
 */
/** `visitId`: a technical visit's card (lv01, agentes 14/11): its `visita_*` buttons open Lilachat's visit screen. */
export function BotCardView(props: { card: BotCard; chatId: string; seq: number; jwt: string; visitId?: string; /** The message's Portal refs: an «INFORME» card opens its report (José 25/11). */ clientRef?: { kind?: string; serviceId?: string; recordId?: string } }) {
  const { card } = props;
  const colors = useColores();
  // The kit (§118.4): the detail opens in a sheet with the data that came with the message.
  const [detailOpen, setDetailOpen] = useState(false);
  const actions = useAccionesDeTarjeta();
  const { runLine, openVisit, openService } = actions;
  const runRow = runLine ? (line: string) => runLine(line, props.seq, cardContextOf(card) ?? undefined) : undefined;
  const { sent, error, tap } = useCardActionTap(props.chatId, props.jwt, props.seq);
  // A button with a `command` runs its line and the card stays open: its form can be closed.
  const press = (action: CardAction) => {
    if (action.open?.route === 'service') return openService?.(action.open.serviceId);
    const visitAction = props.visitId && openVisit ? visitCardActionOf(action.id) : null;
    if (visitAction) return openVisit!(props.visitId!, visitAction);
    return action.command ? runRow?.(action.command) : void tap(action.id);
  };
  const reportTarget = reportCardTargetOf(card, props.clientRef);
  const buttons = card.actions?.filter((action) => (!action.command || runRow) && (!action.open || openService)) ?? [];
  const width = cardWidthOf(useWindowDimensions().width);
  const visit = Boolean(props.visitId);
  return (
    <AccionesDeTarjetaContext.Provider value={{ ...actions, runLine: runRow }}>
    <View testID="tarjeta-bot" className={`m-1 overflow-hidden ${visit ? 'rounded-[10px]' : 'rounded-xl'} border border-outline/15 bg-surface`} style={{ minWidth: Math.min(CARD_MIN_FILL, width), maxWidth: card.blocks ? width : Math.min(CARD_TEXT_WIDTH, width), width: card.blocks ? width : undefined }}>
      {card.accent ? <View testID="tarjeta-acento" style={{ height: ACCENT_HEIGHT, backgroundColor: colors[ACCENT_COLOR(card.accent)] }} /> : null}
      <CardBody url={card.url}>
        {visit ? <VisitCardHead card={card} /> : <CardHead card={card} />}
        <CardMiddle card={card} visit={visit} seq={props.seq} onShowDetail={() => setDetailOpen(true)} />
        <CardLink card={visit ? withUpdateInFooter(card) : card} />
      </CardBody>
      <CardFoot buttons={buttons} visit={visit} sent={sent} onPress={press} openReport={reportTarget && openService ? () => openService(reportTarget.serviceId, reportTarget.reportId) : null} />
      {visit && card.blocks ? visitBlocksOf(card.blocks).missing.map((block, index) => <View key={`falta-${index}`} className="px-3.5 pb-3"><VisitText block={block} /></View>) : null}
      {error ? <Text className="border-t border-outline/10 px-3.5 py-2 text-[12px] text-error">{error}</Text> : null}
      <BotCardDetail card={card} visible={detailOpen} onClose={() => setDetailOpen(false)} />
    </View>
    </AccionesDeTarjetaContext.Provider>
  );
}
