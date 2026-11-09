import { Play } from 'lucide-react';
import { albumGrid, galleryFiles, type GalleryItem } from '@lilachat/shared';
import { usePortalFileViewer } from '../spaces/clients/PortalFileViewer';

const GAP = 2;
const percent = (fraction: number) => `${fraction * 100}%`;
function span(start: number, size: number): { offset: string; length: string } {
  const before = start > 0 ? GAP / 2 : 0;
  const after = start + size < 1 ? GAP / 2 : 0;
  return { offset: before ? `calc(${percent(start)} + ${before}px)` : percent(start), length: before + after ? `calc(${percent(size)} - ${before + after}px)` : percent(size) };
}

/** A bot's photos and videos as a person's album (José via agentes 09/11): the same grid, «+N» and viewer. */
export function BotFilesAlbum({ seq, files }: { seq: number; files: readonly GalleryItem[] }) {
  const viewer = usePortalFileViewer();
  const viewable = galleryFiles({ type: 'gallery', items: [...files] });
  return (
    <div data-testid={`album-app-${seq}`} className="relative mb-1 aspect-square w-72 max-w-full overflow-hidden rounded-lg bg-black">
      {albumGrid(files.length).map((tile) => {
        const file = files[tile.index]!;
        const across = span(tile.x, tile.w);
        const down = span(tile.y, tile.h);
        const shown = viewable[tile.index]!;
        return (
          <button key={`${file.url}-${tile.index}`} type="button" data-testid={`album-app-foto-${seq}-${tile.index}`} onClick={() => viewer.open(shown, viewable)} className="absolute block" style={{ left: across.offset, top: down.offset, width: across.length, height: down.length }}>
            {file.thumbUrl || file.mime.startsWith('image/') ? <img src={file.thumbUrl ?? file.url} alt={file.label ?? 'Foto'} loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-black" />}
            {file.mime.startsWith('video/') && !tile.more ? <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white"><Play size={20} fill="currentColor" /></span></span> : null}
            {tile.more ? <span className="absolute inset-0 grid place-items-center bg-black/45 text-[28px] font-bold text-white">{`+${tile.more}`}</span> : null}
          </button>
        );
      })}
      {viewer.viewer}
    </div>
  );
}
