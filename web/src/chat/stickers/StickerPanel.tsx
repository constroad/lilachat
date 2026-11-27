import { useRef, useState } from 'react';
import { Clock3, FolderHeart, Star, WandSparkles } from 'lucide-react';
import { stickerSections, type LibrarySticker, type StickerSection, type StickerSectionKey } from '@lilachat/shared';
import { StickerCellMenu, type StickerActions } from './StickerCellMenu';

type Filter = 'all' | 'recent' | 'favorites' | 'mine';
/** «Mis stickers» shows two rows; «Ver todos» opens the rest (design). */
const COLLAPSED_MINE = 7;
const FILTERS: { key: Exclude<Filter, 'all'>; label: string; Icon: typeof Clock3 }[] = [
  { key: 'recent', label: 'Recientes', Icon: Clock3 },
  { key: 'favorites', label: 'Favoritos', Icon: Star },
  { key: 'mine', label: 'Mis stickers', Icon: FolderHeart },
];

type Props = StickerActions & {
  library: LibrarySticker[] | null;
  recents: string[];
  packs: { id: string; title: string; stickers: LibrarySticker[] }[];
  error: string;
  onSend: (sticker: LibrarySticker) => void;
  /** The photo, video or GIF chosen under «Crear» (José 26/11, design sc-01a): the host picks the editor. */
  onCreate: (file: File) => void;
};

/**
 * The web Stickers tab (José, 20/10; design `s1-web-stickers`), the same as
 * the app: Recientes, Favoritos, Mis stickers, the default pack and «Crear»
 * first. A click sends; on hover, «⋯» with its sound, export, favorites and remove (José 27/11, design sa-03).
 */
export function StickerPanel(props: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [allMine, setAllMine] = useState(false);
  const sections = stickerSections({ library: props.library ?? [], recents: props.recents, packs: props.packs });
  const visible = filter === 'all' ? sections : sections.filter((section) => section.key === filter);
  const shown = (section: StickerSection) => (section.key === 'mine' && !allMine && filter === 'all' ? section.stickers.slice(0, COLLAPSED_MINE) : section.stickers);
  return (
    <div data-testid="panel-stickers" className="flex h-[360px] flex-col">
      <div className="flex gap-2 px-1 pb-2">
        {FILTERS.map(({ key, label, Icon }) => {
          const active = filter === key;
          return (
            <button key={key} type="button" data-testid={`filtro-stickers-${key}`} aria-pressed={active} onClick={() => setFilter(active ? 'all' : key)} className={`flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] ${active ? 'border-primary/40 bg-primary/10 font-semibold text-primary' : 'border-outline/20 text-on-surface'}`}>
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
      {props.library === null ? (
        <div data-testid="stickers-cargando" className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 p-1">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-square animate-pulse rounded-2xl bg-background" />)}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {visible.map((section, index) => (
            <section key={section.key} data-testid={`seccion-stickers-${section.key}`}>
              <div className="flex items-center justify-between pb-2 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{section.title}</h4>
                {section.key === 'mine' && filter === 'all' && section.stickers.length > COLLAPSED_MINE ? (
                  <button type="button" data-testid="btn-ver-todos-stickers" onClick={() => setAllMine((before) => !before)} className="text-[12px] font-semibold text-primary">{allMine ? 'Ver menos' : 'Ver todos'}</button>
                ) : null}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                {index === 0 ? <CreateTile onCreate={props.onCreate} /> : null}
                {shown(section).map((sticker) => <Cell key={`${section.key}-${sticker.id}`} sectionKey={section.key} sticker={sticker} {...props} />)}
              </div>
              {section.key === 'mine' && section.stickers.length === 0 ? (
                <p className="pt-3 text-[13px] text-on-surface-variant">Crea tu primer sticker desde una foto, un video o un GIF.</p>
              ) : null}
            </section>
          ))}
        </div>
      )}
      {props.error ? <p role="alert" className="px-1 pb-1 text-[12px] text-error">{props.error}</p> : null}
    </div>
  );
}

/**
 * ONE «Crear» for a photo, a video or a GIF (José 26/11, design sc-01a): the
 * three tiles did the same. It opens the file picker; the file decides the editor.
 */
function CreateTile({ onCreate }: { onCreate: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" data-testid="btn-crear-sticker" onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-1 text-center text-primary">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary"><WandSparkles size={18} /></span>
        <span className="mt-1 text-[12px] font-semibold">Crear</span>
        <span className="text-[10px] leading-tight text-on-surface-variant">Foto, video o GIF</span>
      </button>
      {/* gates-allow: camara the file is only the source of a 512 sticker (cutout or server cut): no stamp, no chat compression */}
      <input ref={input} type="file" accept="image/*,video/*" hidden data-testid="input-crear-sticker" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onCreate(file); }} />
    </>
  );
}

function Cell({ sectionKey, sticker, onSend, ...actions }: Props & { sectionKey: StickerSectionKey; sticker: LibrarySticker }) {
  const key = `${sectionKey}-${sticker.id}`;
  return (
    <div className="group/sticker relative aspect-square">
      <button type="button" data-testid={`sticker-${key}`} aria-label="Mandar el sticker" onClick={() => onSend(sticker)} className="grid h-full w-full place-items-center rounded-2xl border border-outline/10 bg-surface p-1.5 hover:bg-primary/10">
        <img src={sticker.url} alt="" loading="lazy" className="h-full w-full object-contain" />
      </button>
      {sticker.favorite ? <Star size={12} aria-label="En favoritos" className="pointer-events-none absolute bottom-1.5 left-1.5 fill-current text-primary" /> : null}
      <StickerCellMenu sticker={sticker} testKey={key} actions={actions} />
    </div>
  );
}
