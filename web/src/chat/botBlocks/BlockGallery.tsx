import { galleryFiles, galleryStrip, type BotBlock } from '@lilachat/shared';
import { FileThumb, usePortalFileViewer } from '../../spaces/clients/PortalFileViewer';

const THUMB = 64;

/** A unit's photos and videos on its card (José via agentes, 09/11): four thumbnails and «+N»; a tap opens the viewer on all of them. */
export function BlockGallery({ block }: { block: Extract<BotBlock, { type: 'gallery' }> }) {
  const viewer = usePortalFileViewer();
  const files = galleryFiles(block);
  const { shown, more } = galleryStrip(files.length);
  return (
    <div data-testid="bloque-galeria" className="flex flex-wrap gap-1.5">
      {files.slice(0, shown).map((file, index) => {
        const last = index === shown - 1 && more > 0;
        return (
          <button key={file.url} type="button" data-testid={`bloque-galeria-${index}`} aria-label={last ? `Ver ${more} más` : `Ver ${file.name}`} onClick={() => viewer.open(file, files)} className="relative rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <FileThumb file={file} size={THUMB} />
            {last ? <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/55 text-[15px] font-bold text-white">+{more}</span> : null}
          </button>
        );
      })}
      {viewer.viewer}
    </div>
  );
}
