import { albumLayout, alreadyGreeted, formatDayLabel, isHiddenNotice, resolveDeliveryState, startsNewDay, stickerRowLayout, type AlbumRole, type DeliveryState } from '@lilachat/shared';
import { neighboursForGrouping } from './divisorNoLeidos';
import { claveDeFila, tipoDeFila, type Citado } from './filasDelChat';
import { shallowEqual } from './keptValues';
import { isPending, type Row } from './rowKinds';
import type { ChatMessage } from './useChat';

/**
 * What one cell of the conversation draws: its row and everything around it
 * that changes its look. FlashList asks for a cell again when its item or its
 * `renderItem` changes; the drawer depended on `rows`, so a send asked for the
 * ~50 cells on screen three times (147 per send, F4, 03/11) to redraw 2 rows.
 * Built per row and kept while equal, a send redraws its cell and the one above.
 */
export type MessageCell = {
  row: Row;
  mine: boolean;
  /** An album's other photos, the second sticker of a pair or a notice deleted for everyone: drawn by another cell, or not at all. */
  hidden: boolean;
  /** The rows it groups with: the unread divider cuts the block. */
  previous: Row | undefined;
  next: Row | undefined;
  /** The day chip, on the first row of a day. */
  dayLabel: string | undefined;
  /** «N mensajes no leídos» above this row. */
  unreadCount: number | undefined;
  album: readonly ChatMessage[] | undefined;
  pair: readonly [ChatMessage, ChatMessage] | undefined;
  /** My row's ticks; undefined on the others'. */
  delivery: DeliveryState | undefined;
  pairDelivery: readonly [DeliveryState, DeliveryState] | undefined;
  quoted: Citado | null;
  /** «Saludar 👋» on «X se unió», until someone greets. */
  greets: boolean;
  threadHasNew: boolean;
};

export type CellContext = {
  myUserId: string;
  /** The Slack layout: each photo and sticker on its own row. */
  flat: boolean;
  dividerSeq: number | null;
  unreadAtOpen: number;
  otherReadSeq: number;
  otherDeliveredSeq: number;
  quotes: ReadonlyMap<number, Citado>;
  threadHasNew: (seq: number, thread: NonNullable<ChatMessage['hilo']>) => boolean;
};

type Layout = {
  bySeq: ReadonlyMap<number, ChatMessage>;
  albums: ReadonlyMap<number, AlbumRole>;
  pairs: ReadonlyMap<number, AlbumRole>;
  greeting: readonly { seq?: number; senderId?: string; pending?: boolean }[];
};

const NO_LAYOUT: ReadonlyMap<number, AlbumRole> = new Map();

/** One cell per row, in the same order (the list scrolls by index). */
export function buildMessageCells(rows: readonly Row[], context: CellContext): { cells: MessageCell[]; bySeq: ReadonlyMap<number, ChatMessage> } {
  const confirmed = rows.filter((row): row is ChatMessage => !isPending(row));
  const bySeq = new Map(confirmed.map((row) => [row.seq, row]));
  const layout: Layout = {
    bySeq,
    albums: context.flat ? NO_LAYOUT : albumLayout(confirmed),
    pairs: context.flat ? NO_LAYOUT : stickerRowLayout(rows.map((row) => (isPending(row) ? {} : row)), { dividerSeq: context.dividerSeq ?? undefined }),
    greeting: rows.map((row) => (isPending(row) ? { senderId: context.myUserId, pending: true } : row)),
  };
  return { cells: rows.map((_row, index) => cellAt(rows, index, context, layout)), bySeq };
}

function cellAt(rows: readonly Row[], index: number, context: CellContext, layout: Layout): MessageCell {
  const row = rows[index];
  const confirmed = isPending(row) ? undefined : row;
  const mine = !confirmed || confirmed.senderId === context.myUserId;
  return {
    row,
    mine,
    ...neighboursForGrouping(rows, index, context.dividerSeq),
    dayLabel: dayLabelAt(rows, index),
    ...groupedDrawing(confirmed, layout),
    ...ticks(confirmed, mine, layout, context),
    ...extras(confirmed, context, layout),
  };
}

/** The chip goes over the real previous row: the divider does not cut a day. */
function dayLabelAt(rows: readonly Row[], index: number): string | undefined {
  const at = timeOf(rows[index]);
  const previous = rows[index - 1];
  return startsNewDay(at, previous ? timeOf(previous) : undefined) ? formatDayLabel(at) : undefined;
}

const timeOf = (row: Row): string => (isPending(row) ? row.queuedAt : row.at);

/** Albums and sticker pairs: the first row draws them all, the others nothing. */
function groupedDrawing(confirmed: ChatMessage | undefined, layout: Layout): Pick<MessageCell, 'hidden' | 'album' | 'pair'> {
  if (!confirmed) return { hidden: false, album: undefined, pair: undefined };
  const albumRole = layout.albums.get(confirmed.seq);
  const pairRole = layout.pairs.get(confirmed.seq);
  return {
    hidden: albumRole?.role === 'member' || pairRole?.role === 'member' || isHiddenNotice(confirmed),
    album: albumRole?.role === 'head' ? messagesOf(albumRole.seqs, layout.bySeq) : undefined,
    pair: pairOf(pairRole, layout.bySeq),
  };
}

const messagesOf = (seqs: readonly number[], bySeq: ReadonlyMap<number, ChatMessage>): ChatMessage[] =>
  seqs.map((seq) => bySeq.get(seq)).filter((one): one is ChatMessage => Boolean(one));

/** The two stickers of a pair's first row, when both are loaded. */
function pairOf(role: AlbumRole | undefined, bySeq: ReadonlyMap<number, ChatMessage>): readonly [ChatMessage, ChatMessage] | undefined {
  if (role?.role !== 'head') return undefined;
  const [first, second] = role.seqs.map((seq) => bySeq.get(seq));
  return first && second ? [first, second] : undefined;
}

function ticks(confirmed: ChatMessage | undefined, mine: boolean, layout: Layout, context: CellContext): Pick<MessageCell, 'delivery' | 'pairDelivery'> {
  if (!mine) return { delivery: undefined, pairDelivery: undefined };
  const stateOf = (seq: number | null) => resolveDeliveryState({ seq, otherReadSeq: context.otherReadSeq, otherDeliveredSeq: context.otherDeliveredSeq });
  const pair = confirmed ? pairOf(layout.pairs.get(confirmed.seq), layout.bySeq) : undefined;
  return { delivery: stateOf(confirmed?.seq ?? null), pairDelivery: pair ? [stateOf(pair[0].seq), stateOf(pair[1].seq)] : undefined };
}

function extras(confirmed: ChatMessage | undefined, context: CellContext, layout: Layout): Pick<MessageCell, 'unreadCount' | 'quoted' | 'greets' | 'threadHasNew'> {
  if (!confirmed) return { unreadCount: undefined, quoted: null, greets: false, threadHasNew: false };
  const thread = confirmed.hilo;
  return {
    unreadCount: confirmed.seq === context.dividerSeq ? context.unreadAtOpen : undefined,
    quoted: context.quotes.get(confirmed.seq) ?? null,
    greets: confirmed.system?.evento === 'se-unio' && !alreadyGreeted(layout.greeting, confirmed.seq, context.myUserId),
    threadHasNew: Boolean(thread && thread.respuestas > 0 && !confirmed.deletedAt && context.threadHasNew(confirmed.seq, thread)),
  };
}

/** The same values; arrays (album, pair, ticks) and rows compared one level down. */
function sameCell(a: MessageCell, b: MessageCell): boolean {
  const keys = Object.keys(a) as (keyof MessageCell)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key] || shallowEqual(a[key], b[key]));
}

/**
 * `next`, keeping the previous object of every equal cell (by row key), and
 * the previous array when nothing changed: FlashList then does not redraw them.
 */
export function keepCells(previous: readonly MessageCell[] | undefined, next: readonly MessageCell[]): readonly MessageCell[] {
  if (!previous) return next;
  const byKey = new Map(previous.map((cell) => [claveDeFila(cell.row), cell]));
  let changed = previous.length !== next.length;
  const kept = next.map((cell, index) => {
    const before = byKey.get(claveDeFila(cell.row));
    if (!before || !sameCell(before, cell)) {
      changed = true;
      return cell;
    }
    if (previous[index] !== before) changed = true;
    return before;
  });
  return changed ? kept : previous;
}

/** The list's key and recycling type of a cell: its row's. */
export const cellKey = (cell: MessageCell): string => claveDeFila(cell.row);
export const cellType = (cell: MessageCell): ReturnType<typeof tipoDeFila> => tipoDeFila(cell.row);
