import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

export const MENU_WIDTH = 240;
const MENU_MARGIN = 8;
/** Four rows of 44 px and its padding: enough to decide whether it opens above. */
const MENU_HEIGHT = 196;
export type MenuPlace = { left: number; top: number };

/** Where the menu goes: under the «⋯», its right edge on the button's, always inside the window. */
export function menuPlaceOf(button: { left: number; right: number; top: number; bottom: number }, view: { width: number; height: number }): MenuPlace {
  const left = Math.min(Math.max(MENU_MARGIN, button.right - MENU_WIDTH), view.width - MENU_WIDTH - MENU_MARGIN);
  const below = button.bottom + 4;
  const top = below + MENU_HEIGHT > view.height - MENU_MARGIN ? Math.max(MENU_MARGIN, button.top - MENU_HEIGHT - 4) : below;
  return { left, top };
}

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
  const [place, setPlace] = useState<MenuPlace | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const open = place !== null;
  useDismiss(open, box, () => setPlace(null), { ignore: '[data-sticker-menu]' });
  const toggle = () => setPlace((before) => (before || !box.current ? null : menuPlaceOf(box.current.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })));
  const choose = (item: Item) => {
    setPlace(null);
    item.run();
  };
  return (
    <div ref={box} className={`absolute right-1 top-1 ${open ? 'z-20' : 'opacity-0 transition-opacity focus-within:opacity-100 group-hover/sticker:opacity-100'}`}>
      <button type="button" data-testid={`opciones-${testKey}`} aria-label="Opciones del sticker" aria-expanded={open} onClick={toggle} className="grid h-7 w-7 place-items-center rounded-full bg-surface/95 text-on-surface-variant shadow">
        <MoreHorizontal size={15} />
      </button>
      {place ? createPortal(
        // On the page, not inside the panel: the panel scrolls and cut the menu of a sticker at its edge (E2E 27/11).
        <div role="menu" data-sticker-menu data-testid={`menu-${testKey}`} style={{ position: 'fixed', left: place.left, top: place.top, width: MENU_WIDTH }} className="z-50 overflow-hidden rounded-xl border border-outline/15 bg-surface py-1 shadow-lg">
          {itemsOf(sticker, actions).map((item) => (
            <button key={item.key} type="button" role="menuitem" data-testid={`${item.key}-${testKey}`} onClick={() => choose(item)} className={`flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-[14px] hover:bg-background ${item.tone === 'primary' ? 'font-semibold text-primary' : item.tone === 'error' ? 'text-error' : 'text-on-surface'}`}>
              <item.Icon size={16} /> {item.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
