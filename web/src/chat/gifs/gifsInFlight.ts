import { useSyncExternalStore } from 'react';
import type { GifResult } from '@lilachat/shared';
import type { MensajeEnPantalla } from '../types';

/**
 * A GIF shows in the chat the moment it is clicked (José, 22/10: «tarda unos
 * segundos en ser enviado, se siente lento»). The server downloads it from
 * GIPHY and stores it before answering; meanwhile the bubble is GIPHY's
 * preview, «sending». When the real message arrives (same `clientKey`) the
 * conversation drops the pending one.
 */
type InFlight = { chatId: string; clientKey: string; gif: GifResult; at: string };
let inFlight: InFlight[] = [];
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function addGifInFlight(chatId: string, clientKey: string, gif: GifResult): void {
  inFlight = [...inFlight, { chatId, clientKey, gif, at: new Date().toISOString() }];
  announce();
}

export function removeGifInFlight(clientKey: string): void {
  const next = inFlight.filter((one) => one.clientKey !== clientKey);
  if (next.length === inFlight.length) return;
  inFlight = next;
  announce();
}

/** The pending bubble: GIPHY's preview with its shape, «sending». */
export function gifAsPendingMessage(one: InFlight, me: string): MensajeEnPantalla {
  return { chatId: one.chatId, seq: Number.MAX_SAFE_INTEGER, senderId: me, clientKey: one.clientKey, kind: 'image', media: { url: one.gif.previewUrl, mime: 'image/gif', width: one.gif.width || undefined, height: one.gif.height || undefined }, at: one.at, estado: 'enviando' };
}

let snapshot: { all: InFlight[]; byChat: Map<string, InFlight[]> } = { all: inFlight, byChat: new Map() };
const ofChat = (chatId: string): InFlight[] => {
  if (snapshot.all !== inFlight) snapshot = { all: inFlight, byChat: new Map() };
  const cached = snapshot.byChat.get(chatId);
  if (cached) return cached;
  const list = inFlight.filter((one) => one.chatId === chatId);
  snapshot.byChat.set(chatId, list);
  return list;
};

/** This chat's GIFs on their way, live (the same array while nothing changes). */
export function useGifsInFlight(chatId: string): InFlight[] {
  return useSyncExternalStore(subscribe, () => ofChat(chatId));
}
