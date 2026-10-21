/**
 * «Medios» (pending 38, José 21/10): the photos, videos, documents and links
 * of all my chats, like WhatsApp, by month. PURE.
 */
export type MediaLibraryType = 'photos' | 'videos' | 'files' | 'links';

export const MEDIA_LIBRARY_TABS: readonly { type: MediaLibraryType; label: string }[] = [
  { type: 'photos', label: 'Fotos' },
  { type: 'videos', label: 'Videos' },
  { type: 'files', label: 'Documentos' },
  { type: 'links', label: 'Enlaces' },
];

export const mediaLibraryType = (value: unknown): MediaLibraryType => MEDIA_LIBRARY_TABS.find((tab) => tab.type === value)?.type ?? 'photos';

/** One item of the library, as `GET /api/media/library` returns it. */
export type MediaLibraryItem = {
  chatId: string;
  seq: number;
  at: string;
  senderId: string;
  kind: 'image' | 'video' | 'file' | 'text';
  chat: { kind: 'direct' | 'group'; name?: string; phone?: string };
  media?: { url?: string; thumbUrl?: string; mime?: string; fileName?: string; sizeBytes?: number; width?: number; height?: number; durationMs?: number };
  /** The first link of a text message (tab «Enlaces»). */
  link?: string;
  body?: string;
};

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** Peru has no daylight saving: Lima is always five hours behind UTC. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
const limaMonth = (date: Date) => {
  const lima = new Date(date.getTime() + LIMA_OFFSET_MS);
  return { year: lima.getUTCFullYear(), month: lima.getUTCMonth() };
};

export function mediaMonthSections<T extends { at: string }>(items: readonly T[], now: Date): { title: string; items: T[] }[] {
  const today = limaMonth(now);
  const sections: { key: string; title: string; items: T[] }[] = [];
  for (const item of items) {
    const { year, month } = limaMonth(new Date(item.at));
    const key = `${year}-${month}`;
    const title = year === today.year && month === today.month ? 'Este mes' : year === today.year ? MONTHS[month]! : `${MONTHS[month]} de ${year}`;
    const last = sections.at(-1);
    if (last?.key === key) last.items.push(item);
    else sections.push({ key, title, items: [item] });
  }
  return sections.map(({ title, items: grouped }) => ({ title, items: grouped }));
}
