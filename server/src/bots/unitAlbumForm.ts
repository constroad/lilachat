import { ALBUM_TOOL, CLIENT_ID, type AppForm, type FormSchema } from '@lilachat/shared';

/**
 * «Terminar unidad» of a control de pista (José 19/11, spec INFORMES-DESDE-LILACHAT §24): Portal's
 * `enviar_fotos_de_unidad` sends the photos the admin reviewed to the client's group and closes the
 * unit. Nothing to fill: the report, the unit and the urls ride as context; the door asks for an admin.
 */
const ID_MAX = 64;
const URL_MAX = 2048;
/** Four fixed photos and the extras a unit can hold, with room to spare: more is not a unit. */
const PHOTOS_MAX = 40;
const WEB_URL = /^https?:\/\/\S+$/i;
const CONFIRM_ONLY: FormSchema = { type: 'object', properties: {} };

export type UnitAlbumInput = { kind: 'unit_album'; reportId: string; tramoId: string; urls: string[] };
export type UnitAlbumContext = Record<string, string | string[]>;

const idOf = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');

/** The urls in the order the person left them, each once; null when any is not a web address. */
function urlsOf(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > PHOTOS_MAX) return null;
  const urls: string[] = [];
  for (const one of raw) {
    const url = typeof one === 'string' ? one.trim() : '';
    if (!url || url.length > URL_MAX || !WEB_URL.test(url)) return null;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** What the phone sends; anything off the contract is a 400. */
export function unitAlbumInputOf(raw: Record<string, unknown>): UnitAlbumInput | null {
  const [reportId, tramoId, urls] = [idOf(raw.report_id), idOf(raw.tramo_id), urlsOf(raw.fotos)];
  if (!CLIENT_ID.test(reportId) || reportId.length > ID_MAX || !tramoId || tramoId.length > ID_MAX || !urls) return null;
  return { kind: 'unit_album', reportId, tramoId, urls };
}

export const unitAlbumPrepared = (serviceId: string, input: UnitAlbumInput): { form: AppForm; context: UnitAlbumContext } => ({
  form: { id: ALBUM_TOOL, title: 'Enviar fotos al grupo', submitLabel: 'Enviar', schema: CONFIRM_ONLY },
  context: { servicioId: serviceId, informeId: input.reportId, tramoId: input.tramoId, fotos: input.urls },
});
