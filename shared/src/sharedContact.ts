import { normalizePeruPhone } from './phone.js';

/**
 * A contact shared in the chat (pending 9, José 20/10), like WhatsApp: a card
 * with the name and the phone, «Enviar mensaje» when that number is on
 * Lilachat and «Agregar a contactos». The message's `body` says
 * «Contacto: <name>», so the list, the notification and the search read it as
 * any text. Pure: the server validates with this, the app and the web draw it.
 */
export type SharedContact = { name: string; phone: string; userId?: string };
export const CONTACT_NAME_MAX = 60;
const PHONE_MIN_DIGITS = 6;
const PHONE_MAX_DIGITS = 15;

/** `local`: the 9 Peruvian digits when it is a number Lilachat can know (its identity), or `null`. */
export function cleanSharedContact(raw: { name?: unknown; phone?: unknown }): { ok: true; name: string; phone: string; local: string | null } | { ok: false; message: string } {
  const name = String(raw.name ?? '').trim().slice(0, CONTACT_NAME_MAX);
  if (!name) return { ok: false, message: 'El contacto no tiene nombre.' };
  const dialed = String(raw.phone ?? '').trim();
  const local = normalizePeruPhone(dialed) || null;
  const digits = dialed.replace(/\D/g, '');
  if (!local && (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS)) return { ok: false, message: 'El contacto no tiene un teléfono.' };
  return { ok: true, name, phone: local ?? `${dialed.startsWith('+') ? '+' : ''}${digits}`, local };
}

export const sharedContactBody = (name: string): string => `Contacto: ${name}`;
