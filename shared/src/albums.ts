/**
 * Several photos or videos sent together, as one card that slides sideways
 * like Instagram's (pending 12, José 20/10; design `r148-album`). Each one is
 * still its own message with the same `media.album`; the conversation draws
 * them together. PURE.
 */
type AlbumCandidate = { seq?: number; senderId?: string; kind?: string; deletedAt?: string | null; media?: { album?: string } };

export type AlbumRole = { role: 'head'; seqs: number[] } | { role: 'member'; head: number };

const ALBUM_ID = /^[A-Za-z0-9_-]{6,40}$/;

export const isAlbumId = (value: unknown): value is string => typeof value === 'string' && ALBUM_ID.test(value);

/** A new album's id, from the clock and a random part. */
export function newAlbumId(random: () => number = Math.random, now: number = Date.now()): string {
  return `al${now.toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

const albumOf = (row: AlbumCandidate): string | null =>
  !row.deletedAt && typeof row.seq === 'number' && (row.kind === 'image' || row.kind === 'video') && isAlbumId(row.media?.album) ? row.media!.album! : null;

/**
 * The album role of each row, by seq: the first photo of a run draws the card
 * with all of them, the others draw nothing. Only a run of two or more in a
 * row, from the same sender, is an album.
 */
export function albumLayout(rows: readonly AlbumCandidate[]): Map<number, AlbumRole> {
  const layout = new Map<number, AlbumRole>();
  let run: AlbumCandidate[] = [];
  const close = () => {
    if (run.length >= 2) {
      const seqs = run.map((row) => row.seq!);
      layout.set(seqs[0]!, { role: 'head', seqs });
      for (const seq of seqs.slice(1)) layout.set(seq, { role: 'member', head: seqs[0]! });
    }
    run = [];
  };
  for (const row of rows) {
    const album = albumOf(row);
    const continues = album !== null && run.length > 0 && albumOf(run[0]!) === album && run[0]!.senderId === row.senderId;
    if (!continues) close();
    if (album !== null) run.push(row);
  }
  close();
  return layout;
}

/** A tile of the album's square, in fractions of its side; the last one may carry «+N». */
export type AlbumTile = { index: number; x: number; y: number; w: number; h: number; more?: number };

/** The bubble shows at most a 2×2; the rest are in the viewer behind «+N». */
const GRID_SHOWN = 4;
const HALF = 0.5;

/**
 * The album in the bubble as a grid, like WhatsApp (pending 81, José 23/10):
 * 2 side by side, 3 as one big on top and two small, 4 or more as a 2×2 with
 * «+N» on the fourth. The carousel stays in the full-screen viewer.
 */
export function albumGrid(count: number): AlbumTile[] {
  if (count < 2) return [];
  if (count === 2) return [0, 1].map((index) => ({ index, x: index * HALF, y: 0, w: HALF, h: 1 }));
  if (count === 3) return [{ index: 0, x: 0, y: 0, w: 1, h: HALF }, { index: 1, x: 0, y: HALF, w: HALF, h: HALF }, { index: 2, x: HALF, y: HALF, w: HALF, h: HALF }];
  return [0, 1, 2, 3].map((index) => ({
    index,
    x: (index % 2) * HALF,
    y: Math.floor(index / 2) * HALF,
    w: HALF,
    h: HALF,
    ...(index === GRID_SHOWN - 1 && count > GRID_SHOWN ? { more: count - GRID_SHOWN } : {}),
  }));
}
