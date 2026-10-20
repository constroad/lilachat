/**
 * Stickers (José, 20/10: «I upload a photo, the background goes away, I add
 * text and make a sticker, like WhatsApp»). Pure logic shared by app, web and
 * server: the library, recents, the default pack and the panel sections.
 */
export type LibrarySticker = {
  id: string;
  /** Absolute. A 512×512 WebP or PNG with a transparent background. */
  url: string;
  mime: string;
  width: number;
  height: number;
  favorite: boolean;
  at: string;
};

export type StickerSectionKey = 'recent' | 'favorites' | 'mine' | `pack:${string}`;
export type StickerSection = { key: StickerSectionKey; title: string; stickers: LibrarySticker[] };

/** How many recents are remembered (they live on the device, like WhatsApp). */
export const RECENT_STICKERS_LIMIT = 24;
/** Side of a sticker file, like WhatsApp. */
export const STICKER_SIZE = 512;
export const PACK_STICKER_PREFIX = 'pack:';

export type PackSticker = { slug: string; label: string };
export type StickerPack = { id: string; title: string; stickers: PackSticker[] };

/**
 * The default pack (design `s1-app-panel-stickers` shows a full panel from day
 * one). Art: the Stitch sheet `s1-pack-lila` (vector, same style as the
 * design), rendered to 512×512 WebP by `web/scripts/extract-sticker-pack.mjs`;
 * the files live in `web/public/stickers/<pack>/` and the server that serves
 * the web hosts them.
 */
export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'lila-1',
    title: 'Lila',
    stickers: [
      { slug: 'dog-ready', label: '¡Listo!' },
      { slug: 'worker-go', label: '¡Vamos!' },
      { slug: 'thumbs-up', label: 'Pulgar arriba' },
      { slug: 'cat', label: 'Gato' },
      { slug: 'coffee', label: 'Buenos días' },
      { slug: 'thanks', label: 'Gracias' },
      { slug: 'party', label: '¡Felicidades!' },
      { slug: 'trophy', label: '¡Bravo!' },
      { slug: 'approved', label: 'Aprobado' },
      { slug: 'on-the-way', label: 'En camino' },
      { slug: 'hello', label: '¡Hola!' },
      { slug: 'ok', label: 'OK' },
      { slug: 'strong', label: '¡Fuerza!' },
      { slug: 'good-night', label: 'Buenas noches' },
      { slug: 'laugh', label: 'Risa' },
      { slug: 'heart', label: 'Corazón' },
      { slug: 'fire', label: 'Fuego' },
      { slug: 'rocket', label: 'Cohete' },
      { slug: 'clap', label: 'Aplausos' },
      { slug: 'thinking', label: 'Pensando' },
      { slug: 'hundred', label: 'Cien' },
      { slug: 'star-struck', label: 'Asombro' },
      { slug: 'crane', label: 'Grúa' },
      { slug: 'helmet', label: 'Casco' },
    ],
  },
];

const SLUG = /^[a-z0-9-]+$/;

/** The last used goes first, without repeats; the oldest drops past the limit. */
export function addRecentSticker(recents: readonly string[], id: string): string[] {
  return [id, ...recents.filter((one) => one !== id)].slice(0, RECENT_STICKERS_LIMIT);
}

export const packStickerId = (packId: string, slug: string) => `${PACK_STICKER_PREFIX}${packId}/${slug}`;
export const packStickerPath = (packId: string, slug: string) => `/stickers/${packId}/${slug}.webp`;

/** A `pack:<pack>/<slug>` id from the catalog, or null (unknown or malformed). */
export function findPackSticker(id: string): { packId: string; slug: string; label: string } | null {
  if (!id.startsWith(PACK_STICKER_PREFIX)) return null;
  const [packId, slug, ...rest] = id.slice(PACK_STICKER_PREFIX.length).split('/');
  if (!packId || !slug || rest.length || !SLUG.test(slug)) return null;
  const found = STICKER_PACKS.find((pack) => pack.id === packId)?.stickers.find((one) => one.slug === slug);
  return found ? { packId, slug, label: found.label } : null;
}

/** Every pack as stickers ready to show and send, with absolute urls on `baseUrl`. */
export function packLibrary(baseUrl: string): LibrarySticker[] {
  return STICKER_PACKS.flatMap((pack) =>
    pack.stickers.map((one) => ({ id: packStickerId(pack.id, one.slug), url: `${baseUrl}${packStickerPath(pack.id, one.slug)}`, mime: 'image/webp', width: STICKER_SIZE, height: STICKER_SIZE, favorite: false, at: '' }))
  );
}

/** The panel sections. «Mis stickers» is always there: «Crear» lives in it. */
export function stickerSections(params: { library: readonly LibrarySticker[]; recents: readonly string[]; packs: readonly { id: string; title: string; stickers: LibrarySticker[] }[] }): StickerSection[] {
  const byId = new Map([...params.packs.flatMap((pack) => pack.stickers), ...params.library].map((one) => [one.id, one]));
  const recent = params.recents.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const favorites = params.library.filter((one) => one.favorite);
  return [
    ...(recent.length ? [{ key: 'recent' as const, title: 'Recientes', stickers: recent }] : []),
    ...(favorites.length ? [{ key: 'favorites' as const, title: 'Favoritos', stickers: favorites }] : []),
    { key: 'mine', title: 'Mis stickers', stickers: [...params.library] },
    ...params.packs.map((pack) => ({ key: `pack:${pack.id}` as const, title: pack.title, stickers: pack.stickers })),
  ];
}
