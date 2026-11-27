import { useRef, useState } from 'react';
import { MoreHorizontal, Music, Share, Star, Trash2, VolumeOff, type LucideIcon } from 'lucide-react';
import { stickerOptionsOf, type LibrarySticker } from '@lilachat/shared';
import { useDismiss } from '../../ui/useDismiss';

export type StickerActions = {
  onSound: (sticker: LibrarySticker) => void;
  onRemoveSound: (sticker: LibrarySticker) => void;
  onExport: (sticker: LibrarySticker) => void;
  onToggleFavorite: (sticker: LibrarySticker) => void;
  onRemove: (sticker: LibrarySticker) => void;
};

type Item = { key: string; label: string; Icon: LucideIcon; tone?: 'primary' | 'error'; run: () => void };

/** What the menu offers for this sticker, in the order of design sa-03: its sound first. */
function itemsOf(sticker: LibrarySticker, actions: StickerActions): Item[] {
  const options = stickerOptionsOf(sticker);
  return [
    { key: 'sonido', label: options.sound, Icon: Music, tone: 'primary' as const, run: () => actions.onSound(sticker) },
    ...(options.canRemoveSound ? [{ key: 'quitar-sonido', label: 'Quitar sonido', Icon: VolumeOff, run: () => actions.onRemoveSound(sticker) }] : []),
    ...(options.canExport ? [{ key: 'exportar', label: 'Exportar para WhatsApp', Icon: Share, run: () => actions.onExport(sticker) }] : []),
    { key: 'favorito', label: options.favorite, Icon: Star, run: () => actions.onToggleFavorite(sticker) },
    ...(options.canRemove ? [{ key: 'quitar', label: 'Quitar de Mis stickers', Icon: Trash2, tone: 'error' as const, run: () => actions.onRemove(sticker) }] : []),
  ];
}

/**
 * The «⋯» of a saved sticker on the web (José 27/11, design sa-03): on hover, and its menu with the sound, export,
 * favorites and removing it. A click on the sticker still sends it.
 */
export function StickerCellMenu({ sticker, testKey, actions }: { sticker: LibrarySticker; testKey: string; actions: StickerActions }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, box, () => setOpen(false));
  const choose = (item: Item) => {
    setOpen(false);
    item.run();
  };
  return (
    <div ref={box} className={`absolute right-1 top-1 ${open ? 'z-20' : 'opacity-0 transition-opacity focus-within:opacity-100 group-hover/sticker:opacity-100'}`}>
      <button type="button" data-testid={`opciones-${testKey}`} aria-label="Opciones del sticker" aria-expanded={open} onClick={() => setOpen((before) => !before)} className="grid h-7 w-7 place-items-center rounded-full bg-surface/95 text-on-surface-variant shadow">
        <MoreHorizontal size={15} />
      </button>
      {open ? (
        <div role="menu" data-testid={`menu-${testKey}`} className="absolute right-0 top-8 w-60 overflow-hidden rounded-xl border border-outline/15 bg-surface py-1 shadow-lg">
          {itemsOf(sticker, actions).map((item) => (
            <button key={item.key} type="button" role="menuitem" data-testid={`${item.key}-${testKey}`} onClick={() => choose(item)} className={`flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-[14px] hover:bg-background ${item.tone === 'primary' ? 'font-semibold text-primary' : item.tone === 'error' ? 'text-error' : 'text-on-surface'}`}>
              <item.Icon size={16} /> {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
