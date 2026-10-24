import { findPackSticker } from './stickers.js';
import { winkById, type WinkId } from './winks.js';

/**
 * A wink or a sticker sent during a call (pending 98; José, 23/10). It is
 * not a message: it travels with the call's signals (`call.reaction`), plays
 * over the other side's call screen and is gone. Only catalog ids travel, so
 * a peer can never make the other screen load an outside image.
 */
export type CallReaction = { kind: 'wink'; id: WinkId } | { kind: 'sticker'; id: string };

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
  return null;
}
