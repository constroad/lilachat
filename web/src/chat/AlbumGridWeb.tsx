import { Play } from 'lucide-react';
import { albumGrid } from '@lilachat/shared';
import type { MensajeEnPantalla } from './types';

/** The thin line between photos (px). */
const GAP = 2;
const percent = (fraction: number) => `${fraction * 100}%`;

/** Where a tile starts and how long it is along one side, leaving half the gap on each inner edge. */
function span(start: number, size: number): { offset: string; length: string } {
  const before = start > 0 ? GAP / 2 : 0;
  const after = start + size < 1 ? GAP / 2 : 0;
  const offset = before ? `calc(${percent(start)} + ${before}px)` : percent(start);
  const length = before + after ? `calc(${percent(size)} - ${before + after}px)` : percent(size);
  return { offset, length };
}

/**
 * Several photos or videos sent together, as a grid like WhatsApp's (pending
 * 81, José 23/10): 2 side by side, 3 as one big and two small, 4 or more as a
 * 2×2 with «+N» on the fourth. A click opens the viewer on that photo, where
 * they slide; the first one's caption goes under the card like any photo.
 */
export function AlbumGridWeb(props: { items: readonly MensajeEnPantalla[]; onOpen: (message: MensajeEnPantalla) => void }) {
  const { items } = props;
  const head = items[0]!;
  return (
    <div data-testid={`album-${head.seq}`} className="relative mb-1 aspect-square w-72 max-w-full overflow-hidden rounded-lg bg-black">
      {albumGrid(items.length).map((tile) => {
        const item = items[tile.index]!;
        const across = span(tile.x, tile.w);
        const down = span(tile.y, tile.h);
        const media = item.media;
        return (
          <button key={item.seq} type="button" data-testid={`album-foto-${item.seq}`} onClick={() => props.onOpen(item)} className="absolute block" style={{ left: across.offset, top: down.offset, width: across.length, height: down.length }}>
            <img src={media?.thumbUrl || media?.url} alt={item.body ?? 'Foto'} className="h-full w-full object-cover" />
            {media?.mime?.startsWith('video/') && !tile.more ? (
              <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white"><Play size={20} fill="currentColor" /></span></span>
            ) : null}
            {tile.more ? <span data-testid={`album-mas-${head.seq}`} className="absolute inset-0 grid place-items-center bg-black/45 text-[28px] font-bold text-white">{`+${tile.more}`}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
