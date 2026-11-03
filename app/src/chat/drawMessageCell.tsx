import type { ComponentProps, ReactElement } from 'react';
import { canOpenThread, isAnimatedImage, memberBadge, miReaccion, puedeReaccionar, type MemberPill } from '@lilachat/shared';
import { DivisorNoLeidos } from './useDivisorNoLeidos';
import { DaySeparator, isPending, MessageRow, type Row } from './MessageRow';
import { ChipDeHilo } from './ChipDeHilo';
import { BarraDeReacciones } from './reacciones/BarraDeReacciones';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import type { ChatMessage } from './useChat';
import { FLAT_INDENT, FlatMessageRow } from './FlatMessageRow';
import { drawsAsFlatRow } from './rowKinds';
import { convertGifToSticker } from './gifs/gifOptions';
import { StickerPair } from './stickers/StickerMessage';
import type { MessageCell } from './messageCells';

type RowProps = ComponentProps<typeof MessageRow>;

/** What every cell reads from the chat: one object until one of these changes, so a send does not ask for every cell again (F4, 03/11). */
export type CellDrawContext = {
  myUserId: string;
  jwt: string;
  encrypted: boolean;
  isGroup: boolean;
  /** The Slack layout (design `s-01`). */
  flat: boolean;
  names: ReadonlyMap<string, string>;
  photos: ReadonlyMap<string, string>;
  /** Each member's role: the pill next to the name in the Slack format. */
  roles: ReadonlyMap<string, MemberPill>;
  chosen: ReadonlySet<number>;
  selecting: boolean;
  highlighted: number | null;
  searched: number | null | undefined;
  starred: ReadonlySet<number>;
  onOpenMedia: RowProps['onVerImagen'];
  onSelect: RowProps['onSeleccionar'];
  onReply: RowProps['onResponder'];
  onFailed: RowProps['onFallido'];
  onGoToQuote: RowProps['onTocarCita'];
  onOpenThread: (seq: number) => void;
  onReact: (seq: number, emoji: string | null) => void;
  onMoreEmojis: (seq: number) => void;
  onShowReactions: (seq: number) => void;
  onGreet?: () => void;
  onShowPerson?: (userId: string) => void;
};

type Placement = { centered: boolean; flatRow: boolean; indent: number | undefined; senderId: string };

/** One cell of the conversation: the day chip, the unread divider, the bubble (or pair, or flat row) and what hangs below it. */
export function drawMessageCell(cell: MessageCell, chat: CellDrawContext): ReactElement {
  // The rest of an album or a pair is in its first cell; a notice deleted for everyone is not drawn.
  if (cell.hidden) return <></>;
  const placement = placementOf(cell.row, chat);
  return (
    <>
      {cell.dayLabel ? <DaySeparator label={cell.dayLabel} /> : null}
      {cell.unreadCount !== undefined ? <DivisorNoLeidos cantidad={cell.unreadCount} /> : null}
      {drawReactionBar(cell, chat, placement)}
      {drawBody(cell, chat, placement)}
      {drawBelow(cell, chat, placement)}
    </>
  );
}

function placementOf(row: Row, chat: CellDrawContext): Placement {
  // A highlighted notice sits in the middle: so do its bar, reactions and thread chip (21/10).
  const centered = !isPending(row) && row.kind === 'system';
  const flatRow = chat.flat && drawsAsFlatRow(row);
  return { centered, flatRow, indent: flatRow ? FLAT_INDENT : undefined, senderId: isPending(row) ? chat.myUserId : String(row.senderId) };
}

const isChosen = (seq: number, chat: CellDrawContext): boolean => chat.chosen.has(seq) || seq === chat.highlighted || seq === chat.searched;

/** The emoji bar over the one chosen message (of the pair, the chosen sticker). */
function drawReactionBar(cell: MessageCell, chat: CellDrawContext, placement: Placement): ReactElement | null {
  const target: Row = cell.pair?.find((one) => chat.chosen.size === 1 && chat.chosen.has(one.seq)) ?? cell.row;
  if (isPending(target) || chat.chosen.size !== 1 || !chat.chosen.has(target.seq)) return null;
  const facts = { seq: target.seq, deletedAt: target.deletedAt, kind: target.kind, system: target.system, cifrado: chat.encrypted };
  if (!puedeReaccionar(facts)) return null;
  // «Responder en hilo» under the emojis: drops the selection and opens the thread.
  const withThread = canOpenThread({ ...facts, hiloDe: target.hiloDe });
  // A GIF (José, 22/10): «Convertir en sticker animado» under the emojis; not in a secret chat, where it is encrypted.
  const withGifSticker = !chat.encrypted && !target.deletedAt && isAnimatedImage(target.media?.mime);
  const openThread = (seq: number) => {
    chat.onSelect?.(seq);
    chat.onOpenThread(seq);
  };
  const toSticker = (seq: number) => {
    chat.onSelect?.(seq);
    void convertGifToSticker(chat.jwt, target.chatId, seq);
  };
  return <BarraDeReacciones seq={target.seq} mia={cell.mine} conAvatar={false} centered={placement.centered} indent={placement.indent} miEmoji={miReaccion(target.reacciones, chat.myUserId)} onElegir={chat.onReact} onMas={chat.onMoreEmojis} onHilo={withThread ? openThread : undefined} onGifSticker={withGifSticker ? toSticker : undefined} />;
}

function drawBody(cell: MessageCell, chat: CellDrawContext, placement: Placement): ReactElement {
  if (cell.pair) return drawPair(cell, cell.pair, chat, placement);
  return placement.flatRow ? drawFlatRow(cell, chat, placement) : drawBubble(cell, chat);
}

function drawPair(cell: MessageCell, pair: readonly [ChatMessage, ChatMessage], chat: CellDrawContext, placement: Placement): ReactElement {
  const { senderId } = placement;
  return (
    <StickerPair
      items={pair}
      mine={cell.mine}
      jwt={chat.jwt}
      delivery={(seq) => cell.pairDelivery?.[seq === pair[1].seq ? 1 : 0] ?? 'sent'}
      starred={(seq) => chat.starred.has(seq)}
      selected={(seq) => isChosen(seq, chat)}
      author={chat.isGroup && !cell.mine ? { name: chat.names.get(senderId) ?? '', photo: chat.photos.get(senderId) } : undefined}
      onSelect={chat.onSelect}
      selecting={chat.selecting}
    />
  );
}

function drawFlatRow(cell: MessageCell, chat: CellDrawContext, placement: Placement): ReactElement {
  const { row } = cell;
  const { senderId } = placement;
  return (
    <FlatMessageRow
      item={row}
      previous={cell.previous}
      myUserId={chat.myUserId}
      jwt={chat.jwt}
      linkPreview={!chat.encrypted}
      names={chat.names}
      everyName={chat.names}
      delivery={cell.delivery}
      authorName={chat.names.get(senderId)}
      authorPhoto={chat.photos.get(senderId)}
      badge={memberBadge({ ...chat.roles.get(senderId), isMe: cell.mine })}
      authorIsApp={chat.roles.get(senderId)?.role === 'app'}
      quoted={cell.quoted}
      selected={!isPending(row) && isChosen(row.seq, chat)}
      selecting={chat.selecting}
      starred={!isPending(row) && chat.starred.has(row.seq)}
      onOpenMedia={chat.onOpenMedia}
      onSelect={chat.onSelect}
      onReply={chat.onReply}
      onFailed={chat.onFailed}
      onGoToQuote={chat.onGoToQuote}
      onOpenThread={chat.onOpenThread}
      onShowPerson={chat.onShowPerson}
    />
  );
}

function drawBubble(cell: MessageCell, chat: CellDrawContext): ReactElement {
  const { row } = cell;
  const author = isPending(row) ? undefined : String(row.senderId);
  return (
    <MessageRow
      item={row}
      previous={cell.previous}
      next={cell.next}
      myUserId={chat.myUserId}
      jwt={chat.jwt}
      conVistaPrevia={!chat.encrypted}
      nombres={chat.isGroup ? chat.names : undefined}
      everyName={chat.names}
      entrega={cell.delivery}
      esGrupo={chat.isGroup}
      nombreAutor={author === undefined ? undefined : chat.names.get(author)}
      fotoAutor={author === undefined ? undefined : chat.photos.get(author)}
      onGreet={cell.greets ? chat.onGreet : undefined}
      onVerImagen={chat.onOpenMedia}
      onSeleccionar={chat.onSelect}
      enSeleccion={chat.selecting}
      onResponder={chat.onReply}
      citado={cell.quoted}
      seleccionado={!isPending(row) && isChosen(row.seq, chat)}
      onFallido={chat.onFailed}
      onTocarCita={chat.onGoToQuote}
      onAbrirHilo={chat.onOpenThread}
      destacado={!isPending(row) && chat.starred.has(row.seq)}
      album={cell.album}
      onShowPerson={chat.onShowPerson}
    />
  );
}

/** The reactions pill and the thread chip, under a confirmed message that was not deleted. */
function drawBelow(cell: MessageCell, chat: CellDrawContext, placement: Placement): ReactElement | null {
  const { row } = cell;
  if (isPending(row) || row.deletedAt) return null;
  const withAvatar = chat.isGroup && !cell.mine;
  return (
    <>
      {row.reacciones?.length ? (
        <PastillaDeReacciones id={String(row.seq)} reacciones={row.reacciones} yo={chat.myUserId} mia={cell.mine} conAvatar={withAvatar} centered={placement.centered} indent={placement.indent} seq={row.seq} onTocar={chat.onShowReactions} />
      ) : null}
      {row.hilo && row.hilo.respuestas > 0 ? (
        <ChipDeHilo
          seq={row.seq}
          bubbleKey={`${row.chatId}:${row.seq}`}
          hilo={row.hilo}
          mia={cell.mine}
          conAvatar={withAvatar}
          centered={placement.centered}
          indent={placement.indent}
          nombres={chat.names}
          fotos={chat.photos}
          nuevas={cell.threadHasNew}
          onAbrir={chat.onOpenThread}
        />
      ) : null}
    </>
  );
}
