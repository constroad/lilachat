import { normalizePeruPhone } from './phone.js';

/**
 * Contacts on the web, like WhatsApp Web (José, 20/10, option «b»): the web
 * asks for the names of the numbers it shows, the server passes the request
 * to the SAME user's phone, the phone answers from its address book and the
 * server hands the answer back. Nothing is stored on the server; the web
 * keeps the names on that computer.
 *
 * These are the two filters the server applies on the way.
 */

/** Numbers per request: a long chat list fits, a dump of the whole address book does not. */
export const AGENDA_MAX_PHONES = 500;
const MAX_NAME_LENGTH = 80;

/** The numbers the web asks for: normalized, without repeats, at most `AGENDA_MAX_PHONES`. */
export function cleanPhonesRequest(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const phones = new Set<string>();
  for (const value of input) {
    const phone = normalizePeruPhone(value);
    if (phone) phones.add(phone);
    if (phones.size >= AGENDA_MAX_PHONES) break;
  }
  return [...phones];
}

/** The phone's answer: only the numbers that were asked for, with a name of reasonable length. */
export function cleanNamesReply(input: unknown, asked: ReadonlySet<string>): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const names: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const phone = normalizePeruPhone(key);
    const name = typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : '';
    if (phone && asked.has(phone) && name) names[phone] = name;
  }
  return names;
}

/** What the phone sends back: the names it has for the numbers asked (its address book indexed by number). */
export function namesFromAgenda(phones: readonly string[], agenda: ReadonlyMap<string, string>): Record<string, string> {
  const names: Record<string, string> = {};
  for (const phone of phones) {
    const name = agenda.get(phone)?.trim();
    if (name) names[phone] = name;
  }
  return names;
}
