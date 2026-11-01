import type { AlbumRole } from './albums.js';

/**
 * Stickers one person sent in a row, two side by side, like WhatsApp (José,
 * 02/11: «se muestran uno tras otro, no 2 en una sola fila»). Each one is still
 * its own message; the conversation draws the pair in one row. PURE.
 */
type StickerCandidate = {
  seq?: number;
  senderId?: string;
  kind?: string;
  at?: string;
  deletedAt?: string | null;
  replyToSeq?: number | null;
  media?: { url?: string };
  reacciones?: readonly unknown[];
  hilo?: { respuestas?: number } | null;
};

/** Two stickers further apart than this are two moments, not one burst. */
const PAIR_WINDOW_MS = 5 * 60 * 1000;

/** A sticker that can share its row: anything drawn around it (quote, reactions, thread chip) keeps it alone. */
function pairable(row: StickerCandidate): boolean {
  return (
    typeof row.seq === 'number' &&
    row.kind === 'sticker' &&
    Boolean(row.media?.url) &&
    !row.deletedAt &&
    !row.replyToSeq &&
    !row.reacciones?.length &&
    !row.hilo?.respuestas
  );
}

function follows(previous: StickerCandidate, row: StickerCandidate, dividerSeq?: number): boolean {
  if (row.senderId !== previous.senderId || row.seq === dividerSeq) return false;
  const before = new Date(previous.at ?? 0);
  const now = new Date(row.at ?? 0);
  return now.getTime() - before.getTime() <= PAIR_WINDOW_MS && now.toDateString() === before.toDateString();
}

/**
 * The pair role of each sticker, by seq (the same roles as an album): the
 * first of a pair draws both, the second draws nothing. A run of three leaves
 * the third alone.
 */
export function stickerRowLayout(rows: readonly StickerCandidate[], options: { dividerSeq?: number } = {}): Map<number, AlbumRole> {
  const layout = new Map<number, AlbumRole>();
  let open: StickerCandidate | null = null;
  for (const row of rows) {
    if (!pairable(row)) {
      open = null;
      continue;
    }
    if (open && follows(open, row, options.dividerSeq)) {
      layout.set(open.seq!, { role: 'head', seqs: [open.seq!, row.seq!] });
      layout.set(row.seq!, { role: 'member', head: open.seq! });
      open = null;
    } else {
      open = row;
    }
  }
  return layout;
}
