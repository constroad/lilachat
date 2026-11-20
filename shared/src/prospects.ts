/**
 * Dali's prospects (BOTS-API §c-prospectos, José via agentes 16/11): a channel per person who wrote to the
 * company from a paid click-to-WhatsApp ad, in the space «Dali · <empresa>». Every member sees it, with the
 * full number to call. PURE.
 */

/** agentes' stable id, `dali:<companyId>:<hash>`. */
export const PROSPECT_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,119}$/;
/** The scope an admin accepts when installing Dali: «Crear un canal por cada prospecto…». */
export const PROSPECTS_SCOPE = 'prospects:write';
export const contactBadge = 'WhatsApp';

const PHONE_DIGITS = { min: 8, max: 15 };
const NAME_MAX = 60;
const AD_ID_MAX = 64;
const AD_TITLE_MAX = 120;
const AD_URL = /^https:\/\/\S{1,492}$/;
const PERU_MOBILE_LENGTH = 11;

export type ProspectAttendedBy = 'dali' | 'human';
export type ProspectSource = { kind: 'ctwa'; adId?: string; adTitle?: string; adUrl?: string };
export type ProspectState = { name?: string; phone: string; lastActivityAt: string; attendedBy: ProspectAttendedBy; source?: ProspectSource; listing?: 'prospect' | 'chat' };
/** A message the prospect wrote, carried by the bot: who, and when they sent it on WhatsApp. */
export type ProspectAuthor = { name: string; phone: string; sentAt?: string; adTitle?: string };

type Refusal = { ok: false; message: string };
const refuse = (message: string): Refusal => ({ ok: false, message });
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const digitsOf = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

function sourceOf(raw: unknown): { ok: true; source: ProspectSource } | Refusal {
  const body = record(raw);
  if (body.kind !== 'ctwa') return refuse('source.kind hoy solo es ctwa.');
  const source: ProspectSource = { kind: 'ctwa' };
  if (body.ad_id !== undefined) {
    if (String(body.ad_id).length > AD_ID_MAX) return refuse(`source.ad_id va hasta ${AD_ID_MAX}.`);
    source.adId = String(body.ad_id);
  }
  if (body.ad_title !== undefined) {
    if (String(body.ad_title).length > AD_TITLE_MAX) return refuse(`source.ad_title va hasta ${AD_TITLE_MAX}.`);
    source.adTitle = String(body.ad_title).trim();
  }
  if (body.ad_url !== undefined) {
    if (!AD_URL.test(String(body.ad_url))) return refuse('source.ad_url va con https, hasta 500.');
    source.adUrl = String(body.ad_url);
  }
  return { ok: true, source };
}

function nameOf(raw: unknown): { ok: true; name?: string } | Refusal {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== 'string' || raw.trim().length > NAME_MAX) return refuse(`name va como texto, hasta ${NAME_MAX}.`);
  return raw.trim() ? { ok: true, name: raw.trim() } : { ok: true };
}

/** The body of `PUT /api/bots/prospects/:id`, read the same way by the server and its fake. */
export function validateProspectState(raw: unknown): { ok: true; state: ProspectState } | Refusal {
  const body = record(raw);
  const phone = digitsOf(body.phone);
  if (phone.length < PHONE_DIGITS.min || phone.length > PHONE_DIGITS.max) return refuse(`phone lleva de ${PHONE_DIGITS.min} a ${PHONE_DIGITS.max} dígitos.`);
  if (!isIsoDate(body.last_activity_at)) return refuse('last_activity_at va como fecha ISO.');
  if (body.attended_by !== undefined && body.attended_by !== 'dali' && body.attended_by !== 'human') return refuse('attended_by va como dali o human.');
  if (body.listing !== undefined && body.listing !== 'prospect' && body.listing !== 'chat') return refuse('listing va como prospect o chat.');
  const name = nameOf(body.name);
  if (!name.ok) return name;
  const source = body.source === undefined ? null : sourceOf(body.source);
  if (source && !source.ok) return source;
  const state: ProspectState = {
    ...(name.name ? { name: name.name } : {}),
    phone,
    lastActivityAt: body.last_activity_at,
    attendedBy: (body.attended_by as ProspectAttendedBy | undefined) ?? 'dali',
    ...(body.listing !== undefined ? { listing: body.listing as 'prospect' | 'chat' } : {}),
  };
  return { ok: true, state: source ? { ...state, source: source.source } : state };
}

/** «+51 949 123 824» for a Peruvian mobile; any other number with its + and as it came. */
export function shownProspectPhone(digits: string): string {
  if (digits.length === PERU_MOBILE_LENGTH && digits.startsWith('51')) return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return `+${digits}`;
}

export const prospectChannelName = (state: Pick<ProspectState, 'name' | 'phone'>): string => state.name ?? `Prospecto · ${shownProspectPhone(state.phone)}`;

/** Who a message is from for grouping and the header: the prospect is not the bot that carried their words. */
export const authorKeyOf = (message: { senderId: string; prospect?: Pick<ProspectAuthor, 'phone'> }): string => (message.prospect ? `prospect:${message.prospect.phone}` : message.senderId);

/** How a row draws its author when a Dali prospect wrote it: their name and the WhatsApp pill, never the bot's photo. */
export function prospectAuthorView(message: { prospect?: Pick<ProspectAuthor, 'name'> }): { name: string; badge: string; isApp: false } | null {
  return message.prospect ? { name: message.prospect.name, badge: contactBadge, isApp: false } : null;
}
