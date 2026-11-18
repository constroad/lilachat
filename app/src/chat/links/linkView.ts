import { MAX_CATEGORY_NAME, MAX_LINK_CATEGORIES, primerEnlace, type CategoryFilter, type CategoryView, type LinkCard, type LinkCategory, type LinkNoteItem } from '@lilachat/shared';

/**
 * What the «Por categoría» view of a notes chat draws (José 18/11, Stitch
 * nl-01..03), decided here so the screens only draw. PURE: no react-native.
 */
export type LinkListRow =
  | { kind: 'header'; key: string; id: string; name: string; count: number; showAll: boolean }
  | { kind: 'cards'; key: string; items: LinkNoteItem[] };

/** The section's kicker («PUBLICIDAD Y VENTAS · 5 · Ver las 5 →»), in dp. */
export const HEADER_ROW_HEIGHT = 44;
/** A card of 88 dp and the 8 dp under it. */
export const CARD_ROW_HEIGHT = 96;
/** In «Todas», each section shows only its newest links. */
export const NEWEST_PER_SECTION = 3;
const NO_CATEGORY = 'Sin categoría';

const chunk = (list: readonly LinkNoteItem[], size: number): LinkNoteItem[][] => {
  const groups: LinkNoteItem[][] = [];
  for (let start = 0; start < list.length; start += size) groups.push(list.slice(start, start + size));
  return groups;
};

/** The flat rows of the list: a header per section and its cards, `columns` per row. */
export function listRowsOf(view: CategoryView, options: { only: CategoryFilter; query: string; columns: number }): LinkListRow[] {
  const trimmed = options.only === 'all' && !options.query.trim();
  const columns = Math.max(1, options.columns);
  return view.sections.flatMap((section) => {
    const shown = trimmed ? section.items.slice(0, NEWEST_PER_SECTION) : section.items;
    const header: LinkListRow = { kind: 'header', key: `h:${section.id}`, id: section.id, name: section.name, count: section.count, showAll: trimmed && section.count > shown.length };
    const cards = chunk(shown, columns).map((items): LinkListRow => ({ kind: 'cards', key: `c:${section.id}:${items[0]!.seq}`, items }));
    return [header, ...cards];
  });
}

/** Length and offset of every row: `getItemLayout` without measuring. */
export function rowLayoutsOf(rows: readonly LinkListRow[]): { length: number; offset: number }[] {
  let offset = 0;
  return rows.map((row) => {
    const length = row.kind === 'header' ? HEADER_ROW_HEIGHT : CARD_ROW_HEIGHT;
    const layout = { length, offset };
    offset += length;
    return layout;
  });
}

export type LinkChip = { id: CategoryFilter; name: string; count: number; review: boolean };

/** One row of chips: «Todas», each category, «Sin categoría», and the review ones at the end when they have links. */
export function chipRowOf(view: CategoryView): LinkChip[] {
  const chips: LinkChip[] = view.chips.map((chip) => ({ ...chip, review: false }));
  if (view.review.commentBait > 0) chips.push({ id: 'commentBait', name: 'Solo piden comentar', count: view.review.commentBait, review: true });
  if (view.review.unreadable > 0) chips.push({ id: 'unreadable', name: 'No se pudieron leer', count: view.review.unreadable, review: true });
  return chips;
}

/** `msg.link` on the view: the new card in place, or `null` when the view does not have that link (reload: the frame has no date). */
export function applyLinkUpdate(items: readonly LinkNoteItem[], seq: number, link: LinkCard): LinkNoteItem[] | null {
  if (!items.some((one) => one.seq === seq)) return null;
  return items.map((one) => (one.seq === seq ? { ...one, link } : one));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** «02/11», in the phone's time zone; empty for a date that does not parse. */
export function dayMonthOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** The line under the mini card of «Mover de categoría». */
export function categoryNoteOf(link: Pick<LinkCard, 'categoryBy'>): string | null {
  if (link.categoryBy === 'user') return 'La elegiste tú.';
  if (link.categoryBy === 'lila') return 'La eligió Lila al guardarlo. Tú decides.';
  return null;
}

export function categoryNameOf(categories: readonly LinkCategory[], categoryId: string | null | undefined): string {
  return categories.find((category) => category.id === categoryId)?.name ?? NO_CATEGORY;
}

export type PlaceholderKind = 'play' | 'post' | 'page' | 'locked';

/** The flat thumbnail of a card without image: a play for what moves. */
export function placeholderKindOf(link: Pick<LinkCard, 'status' | 'format'>): PlaceholderKind {
  if (link.status === 'unreadable') return 'locked';
  if (link.format === 'reel' || link.format === 'video' || link.format === 'short') return 'play';
  return link.format === 'post' ? 'post' : 'page';
}

/** A shared reel arrives as its bare URL: the bubble shows the card, not the URL again. */
export function isLinkOnlyBody(body: string | undefined): boolean {
  const trimmed = body?.trim() ?? '';
  return trimmed.length > 0 && !/\s/.test(trimmed) && primerEnlace(trimmed) !== null;
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

/** The server's rules, said before the request: `null` when the name can be saved. */
export function categoryNameProblem(name: string, categories: readonly LinkCategory[], renaming?: string): string | null {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Escribe un nombre.';
  if (clean.length > MAX_CATEGORY_NAME) return `Máximo ${MAX_CATEGORY_NAME} letras.`;
  if (categories.some((category) => category.id !== renaming && fold(category.name) === fold(clean))) return 'Ya tienes una categoría con ese nombre.';
  if (!renaming && categories.length >= MAX_LINK_CATEGORIES) return `Llegaste a ${MAX_LINK_CATEGORIES} categorías: une dos antes de crear otra.`;
  return null;
}

export type NotesView = 'chat' | 'links';
export type NotesViews = Record<string, NotesView>;

/** The view each notes chat was left in, as stored on the phone. */
export function parseNotesViews(stored: string | null): NotesViews {
  if (!stored) return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, NotesView] => entry[1] === 'chat' || entry[1] === 'links'));
  } catch {
    return {};
  }
}

export const serializeNotesViews = (views: NotesViews): string => JSON.stringify(views);

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** The two lines of a card: who posted it and what it says, or why there is nothing to say. */
export function cardLinesOf(link: LinkCard): { title: string; body: string } {
  const title = link.author?.trim() || hostOf(link.url);
  if (link.status === 'unreadable') return { title: link.author?.trim() || 'No se pudo leer', body: 'La red no lo muestra sin iniciar sesión' };
  if (link.commentBait) return { title, body: `El post no trae contenido: solo pide comentar ${link.commentBait}` };
  if (link.text?.trim()) return { title, body: link.text.trim() };
  return { title, body: link.status === 'pending' ? 'Lila lo está leyendo…' : link.url };
}
