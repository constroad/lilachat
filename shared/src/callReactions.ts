import { findPackSticker } from './stickers.js';
import { winkById, type WinkId } from './winks.js';

/**
 * A wink or a sticker sent during a call (pending 98; José, 23/10). It is
 * not a message: it travels with the call's signals (`call.reaction`), plays
 * over the other side's call screen and is gone. Only catalog ids travel, so
 * a peer can never make the other screen load an outside image.
 */
export type CallReaction = { kind: 'wink'; id: WinkId } | { kind: 'sticker'; id: string } | { kind: 'emoji'; id: CallEmoji };

/** Quick effects over the call (pending 78), like WhatsApp's: they rise from the bottom and fade. */
export const CALL_EMOJIS = ['❤️', '😂', '👍', '😮', '👏', '🎉'] as const;
export type CallEmoji = (typeof CALL_EMOJIS)[number];
const isCallEmoji = (id: string): id is CallEmoji => (CALL_EMOJIS as readonly string[]).includes(id);

/** How long the sender waits for «seen» before saying the other did not get it (pending 105b). */
export const CALL_REACTION_ACK_MS = 4000;
const REACTION_KEY = /^[A-Za-z0-9-]{1,40}$/;

/** How long a sticker floats over the call before it fades (ms). */
export const CALL_STICKER_MS = 2600;

export function callReactionOf(raw: unknown): CallReaction | null {
  const reaction = raw && typeof raw === 'object' ? (raw as { kind?: unknown; id?: unknown }) : {};
  if (typeof reaction.id !== 'string') return null;
  if (reaction.kind === 'wink') {
    const wink = winkById(reaction.id);
    return wink ? { kind: 'wink', id: wink.id } : null;
  }
  if (reaction.kind === 'sticker') return findPackSticker(reaction.id) ? { kind: 'sticker', id: reaction.id } : null;
  if (reaction.kind === 'emoji') return isCallEmoji(reaction.id) ? { kind: 'emoji', id: reaction.id } : null;
  return null;
}

/** The key a reaction travels with, so the other side can answer «seen». */
export function reactionKeyOf(raw: unknown): string | null {
  return typeof raw === 'string' && REACTION_KEY.test(raw) ? raw : null;
}

export function reactionNotSeenNotice(peerName: string): string {
  return `${peerName} no lo recibió. Puede que tenga que actualizar Lilachat.`;
}

/**
 * Waits for «seen» of each reaction sent (pending 105b): an app without the
 * listener (an old version) never answers, and the sender is told once per
 * reaction instead of believing it arrived.
 */
export function createAckWatch(onMissed: () => void) {
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    sent(key: string): void {
      waiting.set(key, setTimeout(() => {
        waiting.delete(key);
        onMissed();
      }, CALL_REACTION_ACK_MS));
    },
    seen(key: string): void {
      clearTimeout(waiting.get(key));
      waiting.delete(key);
    },
    stop(): void {
      for (const timer of waiting.values()) clearTimeout(timer);
      waiting.clear();
    },
  };
}
