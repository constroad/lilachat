import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { LinkCard } from '@lilachat/shared';
import { fetchLinkNotes, type LinkNotes } from './linkNotesApi';

/**
 * The «Por categoría» data of each notes chat, in memory, shared by the view,
 * every bubble (the category pill) and the move sheet: one request per chat.
 * The socket keeps it current (`msg.link`, `chat.links.changed`); a reload
 * keeps the old view on screen until the new one arrives.
 */
export type LinkNotesState = { status: 'loading' | 'ready' | 'error'; notes: LinkNotes | null; message?: string };
export type MessageLinkChange = { chatId: string; seq: number; link: LinkCard };

const LOADING: LinkNotesState = { status: 'loading', notes: null };
const states = new Map<string, LinkNotesState>();
const listeners = new Map<string, Set<() => void>>();
const tokens = new Map<string, string>();
const inFlight = new Map<string, Promise<void>>();
const linkListeners = new Set<(change: MessageLinkChange) => void>();

function setState(chatId: string, next: LinkNotesState): void {
  states.set(chatId, next);
  listeners.get(chatId)?.forEach((listener) => listener());
}

async function readNotes(jwt: string, chatId: string): Promise<void> {
  const current = states.get(chatId);
  if (!current?.notes) setState(chatId, LOADING);
  const response = await fetchLinkNotes(jwt, chatId);
  if (response.ok) setState(chatId, { status: 'ready', notes: response.data });
  else if (!states.get(chatId)?.notes) setState(chatId, { status: 'error', notes: null, message: response.message });
}

/** Reads the chat's links; a read already on its way is shared. */
export function loadLinkNotes(jwt: string, chatId: string): Promise<void> {
  tokens.set(chatId, jwt);
  const pending = inFlight.get(chatId);
  if (pending) return pending;
  const request = readNotes(jwt, chatId).finally(() => inFlight.delete(chatId));
  inFlight.set(chatId, request);
  return request;
}

function reloadIfLoaded(chatId: string): void {
  const jwt = tokens.get(chatId);
  if (jwt && states.has(chatId)) void loadLinkNotes(jwt, chatId);
}

/** `msg.link`: a message's card changed (read, moved, retried). */
export function receiveMessageLink(change: MessageLinkChange): void {
  linkListeners.forEach((listener) => listener(change));
  const notes = states.get(change.chatId)?.notes;
  if (!notes) return;
  if (!notes.items.some((entry) => entry.seq === change.seq)) return reloadIfLoaded(change.chatId);
  const items = notes.items.map((entry) => (entry.seq === change.seq ? { ...entry, link: change.link } : entry));
  setState(change.chatId, { status: 'ready', notes: { ...notes, items } });
}

/** `chat.links.changed`: categories or the switch changed. */
export function receiveLinksChanged(change: { chatId: string }): void {
  reloadIfLoaded(change.chatId);
}

/** The local base listens here to keep `message.link` current. */
export function subscribeMessageLink(listener: (change: MessageLinkChange) => void): () => void {
  linkListeners.add(listener);
  return () => {
    linkListeners.delete(listener);
  };
}

function subscribeTo(chatId: string, listener: () => void): () => void {
  const set = listeners.get(chatId) ?? new Set();
  set.add(listener);
  listeners.set(chatId, set);
  return () => {
    set.delete(listener);
  };
}

/** The links of a notes chat; `active` false reads nothing (a chat without the switch). */
export function useLinkNotes(jwt: string, chatId: string, active: boolean): { state: LinkNotesState; reload: () => void } {
  const subscribe = useCallback((listener: () => void) => subscribeTo(chatId, listener), [chatId]);
  const state = useSyncExternalStore(subscribe, () => states.get(chatId) ?? LOADING);
  useEffect(() => {
    if (active && jwt && !states.has(chatId)) void loadLinkNotes(jwt, chatId);
  }, [active, jwt, chatId]);
  const reload = useCallback(() => {
    if (jwt) void loadLinkNotes(jwt, chatId);
  }, [jwt, chatId]);
  return { state, reload };
}

/** Tests and a closed session start clean. */
export function forgetLinkNotes(): void {
  states.clear();
  tokens.clear();
  inFlight.clear();
}
