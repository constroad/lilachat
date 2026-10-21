import { cleanPhonesRequest, normalizePeruPhone } from '@lilachat/shared';
import type { BaseLocal } from '../local/baseLocal';

/**
 * The names this user saved in their PHONE, for the numbers the web shows
 * (José, 20/10, option «b», like WhatsApp Web). They arrive from the phone
 * through the server, which keeps nothing; here they live in the user's local
 * base, which is deleted with the session.
 */
const STORAGE_KEY = 'agenda';
const EMPTY: ReadonlyMap<string, string> = new Map();

let names: ReadonlyMap<string, string> = EMPTY;
let owner: BaseLocal | null = null;
let ask: ((phones: string[]) => void) | null = null;
/** Every number the screen needs; asked again on each connection. */
const wanted = new Set<string>();
/** The ones already asked on THIS connection. */
const asked = new Set<string>();
const listeners = new Set<() => void>();

function publish(next: ReadonlyMap<string, string>): void {
  names = next;
  for (const listener of listeners) listener();
}

export const getAgendaNames = (): ReadonlyMap<string, string> => names;

export function subscribeAgendaNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Another user in the same tab never sees the previous one's names. */
export async function loadAgendaNames(base: BaseLocal): Promise<void> {
  if (owner === base) return;
  // Child screens may have asked before the first load: only a CHANGE of user forgets that.
  if (owner) {
    wanted.clear();
    asked.clear();
    publish(EMPTY);
  }
  owner = base;
  const saved = await base.meta.get(STORAGE_KEY).catch(() => undefined);
  if (owner !== base || !saved?.valor || typeof saved.valor !== 'object') return;
  publish(new Map([...Object.entries(saved.valor as Record<string, string>), ...names]));
}

/** What the phone answered: it wins over what was saved (the contact may have been renamed). */
export function mergeAgendaNames(base: BaseLocal, incoming: Record<string, string>): void {
  if (owner !== base || Object.keys(incoming).length === 0) return;
  const next = new Map(names);
  for (const [phone, name] of Object.entries(incoming)) next.set(phone, name);
  publish(next);
  void base.meta.put({ clave: STORAGE_KEY, valor: Object.fromEntries(next) }).catch(() => undefined);
}

function askPending(): void {
  if (!ask) return;
  const fresh = [...wanted].filter((phone) => !asked.has(phone));
  if (fresh.length === 0) return;
  for (const phone of fresh) asked.add(phone);
  ask(fresh);
}

/** The relay registers how to ask (`null` when the socket is gone); a new connection asks everything again. */
export function setAgendaAsker(next: ((phones: string[]) => void) | null): void {
  ask = next;
  asked.clear();
  askPending();
}

/** The numbers the screen shows: asked once per connection, or as soon as there is one. */
export function requestAgendaNames(phones: readonly (string | null | undefined)[]): void {
  for (const phone of cleanPhonesRequest(phones)) wanted.add(phone);
  askPending();
}

/** The saved name for a number, if the phone has one. */
export function agendaNameFor(phone: string | null | undefined, agenda: ReadonlyMap<string, string>): string | undefined {
  const normalized = normalizePeruPhone(phone);
  return normalized ? agenda.get(normalized) : undefined;
}

/** A 1:1 chat shows the name saved in the phone, like the app; groups keep their own name. */
export function chatNameWithAgenda<T extends { kind: string; propio?: boolean; name?: string; phone?: string }>(chat: T, agenda: ReadonlyMap<string, string>): T {
  if (chat.kind !== 'direct' || chat.propio) return chat;
  const saved = agendaNameFor(chat.phone, agenda);
  return saved && saved !== chat.name ? { ...chat, name: saved } : chat;
}
