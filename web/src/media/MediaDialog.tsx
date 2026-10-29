import { useCallback, useEffect, useState } from 'react';
import { FileText, Link as LinkIcon, Play, Search } from 'lucide-react';
import { formatBytes, formatChatTimestamp, MEDIA_LIBRARY_TABS, MEDIA_SEARCH_DELAY_MS, mediaEmptyText, mediaMonthSections, mediaSearchTerm, splitMediaSection, type MediaLibraryItem, type MediaLibraryType } from '@lilachat/shared';
import { FieldError, Overlay } from '../ui/Overlay';
import { mediaLibrary } from '../spaces/spacesApi';

const itemKey = (item: MediaLibraryItem) => `${item.chatId}-${item.seq}`;

/** The search as typed, sent to the server only after a pause. */
function useSettled(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * «Medios» (pending 38, José 21/10: the button at the bottom of WhatsApp
 * Web's rail): photos, videos, documents and links of my chats — the
 * personal ones, or those of the space open — by month. «Todo» and the
 * search since pending 6 (design `busqueda-archivos`). A click opens the
 * chat at that message.
 */
export function MediaDialog(props: { jwt: string; spaceId: string | null; spaceName?: string; chatName: (item: MediaLibraryItem) => string; onOpen: (item: MediaLibraryItem) => void; onClose: () => void }) {
  const [type, setType] = useState<MediaLibraryType>('all');
  const [search, setSearch] = useState('');
  const term = mediaSearchTerm(useSettled(search, MEDIA_SEARCH_DELAY_MS));
  const [items, setItems] = useState<MediaLibraryItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (before?: string) => {
    const response = await mediaLibrary(props.jwt, { type, spaceId: props.spaceId, before, q: term });
    if (!response.ok) return setError(response.message);
    setError('');
    setHasMore(response.data.hasMore);
    setItems((previous) => (before ? [...(previous ?? []), ...response.data.items] : response.data.items));
  }, [props.jwt, props.spaceId, type, term]);
  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  return (
    <Overlay title={props.spaceName ? `Medios de ${props.spaceName}` : 'Medios'} onClose={props.onClose} wide>
      <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-surface-variant px-4 text-on-surface-variant">
        <Search size={18} />
        <input data-testid="medios-buscar" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en archivos compartidos" aria-label="Buscar en archivos compartidos" className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
      </label>
      <div role="tablist" className="flex flex-wrap gap-2">
        {MEDIA_LIBRARY_TABS.map((tab) => (
          <button key={tab.type} type="button" role="tab" data-testid={`medios-${tab.type}`} aria-selected={type === tab.type} onClick={() => setType(tab.type)} className={`h-9 rounded-full px-4 text-sm font-semibold ${type === tab.type ? 'bg-primary text-background' : 'bg-primary/10 text-on-surface-variant hover:bg-primary/15'}`}>{tab.label}</button>
        ))}
      </div>
      <FieldError>{error}</FieldError>
      {items === null && !error ? <div className="mt-4 grid grid-cols-3 gap-0.5 sm:grid-cols-5">{[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="aspect-square animate-pulse bg-background" />)}</div> : null}
      {items !== null && items.length === 0 ? <p className="mt-10 text-center text-sm text-on-surface-variant">{mediaEmptyText(type, term ?? '')}</p> : null}
      {mediaMonthSections(items ?? [], new Date()).map((section) => {
        const { tiles, rows } = splitMediaSection(section.items);
        return (
          <section key={section.title}>
            <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{section.title}</p>
            {tiles.length ? (
              <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-5">
                {tiles.map((item) => (
                  <button key={itemKey(item)} type="button" data-testid={`medio-${itemKey(item)}`} aria-label={`${item.kind === 'image' ? 'Foto' : 'Video'} de ${props.chatName(item)}`} onClick={() => props.onOpen(item)} className="relative aspect-square overflow-hidden bg-background">
                    <img src={item.media?.thumbUrl ?? item.media?.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {item.kind === 'video' ? <span className="absolute inset-0 grid place-items-center"><span className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white"><Play size={16} /></span></span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {rows.map((item) => (
              <button key={itemKey(item)} type="button" data-testid={`medio-${itemKey(item)}`} onClick={() => props.onOpen(item)} className="flex min-h-[56px] w-full items-center gap-3 border-b border-outline/10 text-left hover:bg-background">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{item.kind === 'file' ? <FileText size={18} /> : <LinkIcon size={18} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.kind === 'file' ? (item.media?.fileName ?? 'Documento') : item.link}</span>
                  <span className="block truncate text-[12px] text-on-surface-variant">{[props.chatName(item), item.kind === 'file' && item.media?.sizeBytes ? formatBytes(item.media.sizeBytes) : null, formatChatTimestamp(item.at)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
          </section>
        );
      })}
      {hasMore && items?.length ? <button type="button" data-testid="medios-mas" onClick={() => void load(items.at(-1)!.at)} className="mt-4 h-11 w-full rounded-xl border border-outline/20 text-sm font-semibold text-primary hover:bg-background">Ver más</button> : null}
    </Overlay>
  );
}
