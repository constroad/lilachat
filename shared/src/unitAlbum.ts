import type { FormSection, RepeatItem } from './fieldDocument.js';
import type { ViewableFile } from './fileViewer.js';
import { sectionPhotos } from './reportSaves.js';
import { EXTRA_PHOTO_KIND, unitStateOf, unitTitleOf } from './reportUnits.js';

/**
 * «Terminar unidad» of a control de pista (José 19/11, spec INFORMES-DESDE-LILACHAT §24): the
 * unit's photos go to the client's group only through this button, after the person reviews
 * them. Portal's tool `enviar_fotos_de_unidad` takes the photo urls as the document gives them.
 * PURE: the APK and the web draw from here.
 */
export type AlbumPhoto = { url: string; thumbUrl: string; label: string; hour: string };
export type AlbumCta = { label: string; sentNote?: string };
/** What the review sends: the album in its order, without what the person unchecked or what did not open. */
export type AlbumMarks = { unchecked: ReadonlySet<string>; broken: ReadonlySet<string> };

export const ALBUM_TOOL = 'enviar_fotos_de_unidad';
/** The capture order of a unit's fixed photos; any other kind goes after them, then the extras. */
const CAPTURE_ORDER = ['ingreso', 'temperatura', 'escantillon', 'vacia'];
const EXTRA_LABEL = 'Adicional';
const PHOTO_PREFIX = /^foto de\s+/i;
const TITLE_SEPARATOR = ' · ';
const TIME_ZONE = 'America/Lima';
const PHOTO_MIME = 'image/jpeg';

export const ALBUM_CTA = { finish: 'Terminar unidad', send: 'Enviar fotos al grupo', resend: 'Reenviar fotos' } as const;
export const ALBUM_CLOSES_UNIT = 'La unidad se dará por terminada.';
export const ALBUM_BROKEN_PHOTO = 'No se pudo abrir';
export const ALBUM_CANCEL = 'Cancelar';
export const ALBUM_SENDING = 'Enviando…';
export const ALBUM_SENT = 'Fotos enviadas al grupo.';
export const ALBUM_SEND_FAILED = 'No se pudieron enviar las fotos. Revisa tu señal y vuelve a intentarlo.';

/** «Foto de ingreso» → «Ingreso»; «Unidad vacía · cierra la unidad» → «Unidad vacía». */
function labelOf(section: FormSection): string {
  const bare = section.title.replace(PHOTO_PREFIX, '').split(TITLE_SEPARATOR)[0]!.trim();
  return bare ? bare.charAt(0).toUpperCase() + bare.slice(1) : section.title;
}

/** The caption Portal writes by itself («… · llegada n.º 2 a descarga · F2K-908»): the unit already says it. */
const AUTO_CAPTION = /llegada n\.º/i;
const extraLabelOf = (caption: string): string => (!caption || AUTO_CAPTION.test(caption) ? EXTRA_LABEL : caption);

const rankOf = (section: FormSection): number => {
  if (section.photoKind === EXTRA_PHOTO_KIND) return CAPTURE_ORDER.length + 1;
  const at = CAPTURE_ORDER.indexOf(section.photoKind ?? '');
  return at < 0 ? CAPTURE_ORDER.length : at;
};

/** The unit's photos Portal already has, in capture order; one still on the phone has no url Portal knows. */
export function unitAlbumOf(item: RepeatItem): AlbumPhoto[] {
  const sections = item.sections.filter((one) => one.photoKind).sort((first, second) => rankOf(first) - rankOf(second));
  const seen = new Set<string>();
  const album: AlbumPhoto[] = [];
  for (const section of sections) {
    const extra = section.photoKind === EXTRA_PHOTO_KIND;
    for (const photo of sectionPhotos(section)) {
      if (photo.pending || seen.has(photo.url)) continue;
      seen.add(photo.url);
      album.push({ url: photo.url, thumbUrl: photo.thumbUrl, label: extra ? extraLabelOf(photo.caption) : labelOf(section), hour: photo.hour });
    }
  }
  return album;
}

let sentFormat: Intl.DateTimeFormat | null = null;

/** «Enviadas al grupo el 19/11 a las 10:42», in Lima. */
export function albumSentNote(iso: string): string {
  const parts = (sentFormat ??= new Intl.DateTimeFormat('es-PE', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((one) => one.type === type)?.value ?? '';
  return `Enviadas al grupo el ${part('day')}/${part('month')} a las ${part('hour')}:${part('minute')}`;
}

/** The button of a unit, for every member (José 19/11: «que sea para todos»); only a unit with a photo has something to send. */
export function unitAlbumCta(item: RepeatItem): AlbumCta | null {
  if (unitAlbumOf(item).length === 0) return null;
  if (item.albumSentAt) return { label: ALBUM_CTA.resend, sentNote: albumSentNote(item.albumSentAt) };
  return { label: unitStateOf(item) === 'finished' ? ALBUM_CTA.send : ALBUM_CTA.finish };
}

/** An open unit is closed by the send: the review says so. */
export const albumClosesUnit = (item: RepeatItem): boolean => unitStateOf(item) !== 'finished';

/** «Revisa las fotos de la Unidad 3», or of its plate when Portal gave no number. */
export function albumReviewTitle(item: Pick<RepeatItem, 'title'>): string {
  const { kicker, plate } = unitTitleOf(item);
  return kicker ? `Revisa las fotos de la ${kicker}` : `Revisa las fotos de ${plate}`;
}

const photosWord = (count: number): string => (count === 1 ? '1 foto' : `${count} fotos`);

/** The counter over the button. */
export const albumCountLine = (count: number): string => (count === 1 ? 'Se enviará 1 foto' : `Se enviarán ${count} fotos`);

/** The button: off at zero, so its words never promise nothing. */
export const albumSendLabel = (count: number): string => (count ? `Enviar ${photosWord(count)} al grupo` : ALBUM_CTA.send);

/** The urls to send, in the album's order. */
export const albumSelection = (album: readonly AlbumPhoto[], marks: AlbumMarks): string[] => album.filter((one) => !marks.unchecked.has(one.url) && !marks.broken.has(one.url)).map((one) => one.url);

/** A tap on a thumbnail: checks or unchecks it. One that did not open stays out. */
export function toggleAlbumPhoto(marks: AlbumMarks, url: string): AlbumMarks {
  if (marks.broken.has(url)) return marks;
  const unchecked = new Set(marks.unchecked);
  if (unchecked.has(url)) unchecked.delete(url);
  else unchecked.add(url);
  return { ...marks, unchecked };
}

/** A thumbnail that failed to load: shown broken and never sent. */
export const markAlbumPhotoBroken = (marks: AlbumMarks, url: string): AlbumMarks => (marks.broken.has(url) ? marks : { ...marks, broken: new Set([...marks.broken, url]) });

/** Everything checked when the review opens. */
export const freshAlbumMarks = (): AlbumMarks => ({ unchecked: new Set(), broken: new Set() });

/** The magnifier of a thumbnail: the viewer opens on it, and a swipe goes through the rest of the album. */
export function albumViewOf(album: readonly AlbumPhoto[], url: string): { file: ViewableFile; siblings: ViewableFile[] } | null {
  const siblings = album.map((one) => ({ url: one.url, name: [one.label, one.hour].filter(Boolean).join(TITLE_SEPARATOR), mime: PHOTO_MIME, thumbUrl: one.thumbUrl }));
  const file = siblings.find((one) => one.url === url);
  return file ? { file, siblings } : null;
}
