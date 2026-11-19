import type { MediaState } from './callMedia.js';

/**
 * Keeping an answered call alive when its media path is lost (José 19/11: the call was
 * cut when the phone locked or he switched apps, without anyone hanging up).
 *
 * The cause: locking the phone or leaving the app can change or sleep its network
 * (on 22/10 the same phone cut the APK download when the screen locked). ICE kept
 * the old path, reached `failed` and the app hung up at once (`call.end`
 * «desconectada»); nothing restarted ICE on the new network. Now the call reads
 * «Reconectando…» and the caller restarts ICE over the same signaling. Only the
 * caller offers (the one who answered asks it to), so the two never offer at once.
 * PURE: the app and the web call it with the raw `iceConnectionState`.
 */
export type IceRecovery = 'restart' | 'ask-restart' | 'none';

/** A new offer with ICE restart, or (without `sdp`) the other side asking for one. */
export const CALL_RESTART = 'call.restart';
/** The answer to a restart offer. */
export const CALL_RESTART_ANSWER = 'call.restart.answer';

/** The ICE states of a lost path. `checking` after a restart is the restart working. */
const LOST_ICE_STATES: ReadonlySet<string> = new Set(['disconnected', 'failed']);
/** Where a new local offer is allowed: stable, or over a restart offer whose answer got lost. */
const OFFER_STATES: ReadonlySet<string> = new Set(['stable', 'have-local-offer']);

const recoveryFor = (caller: boolean): IceRecovery => (caller ? 'restart' : 'ask-restart');

/** What to do when ICE changes state during an answered call. */
export function iceRecoveryOn(params: { ice: string; connectedBefore: boolean; caller: boolean }): IceRecovery {
  if (!params.connectedBefore || !LOST_ICE_STATES.has(params.ice)) return 'none';
  return recoveryFor(params.caller);
}

/** The socket came back (it drops too when the network changes): a restart sent meanwhile may be lost. */
export function recoveryOnReconnect(params: { active: boolean; media: MediaState; caller: boolean }): IceRecovery {
  if (!params.active || params.media !== 'reconectando') return 'none';
  return recoveryFor(params.caller);
}

export function canOfferRestart(signalingState: string): boolean {
  return OFFER_STATES.has(signalingState);
}

export type RestartSdp = { type: 'offer' | 'answer'; sdp: string };
/** `restartId` numbers the caller's restart offers; the answer echoes it. */
export type RestartFrame = { chatId: string; sdp?: RestartSdp; restartId?: number };

/** A late answer to an older restart offer would pair the wrong ICE credentials: only the last one counts. */
export function answersCurrentRestart(params: { answerId: number | undefined; currentId: number; signalingState: string }): boolean {
  return params.signalingState === 'have-local-offer' && params.answerId === params.currentId;
}

const restartIdOf = (value: unknown): number | undefined => (Number.isInteger(value) && (value as number) > 0 ? (value as number) : undefined);

function sdpOf(value: unknown, type: RestartSdp['type']): RestartSdp | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { type?: unknown; sdp?: unknown };
  return candidate.type === type && typeof candidate.sdp === 'string' && candidate.sdp.length > 0 ? { type, sdp: candidate.sdp } : null;
}

/** A restart frame from the socket, checked: an offer (or none) for `call.restart`, an answer for its answer. */
export function restartFrameOf(frame: unknown, event: typeof CALL_RESTART | typeof CALL_RESTART_ANSWER): RestartFrame | null {
  if (!frame || typeof frame !== 'object') return null;
  const { chatId, sdp, restartId } = frame as { chatId?: unknown; sdp?: unknown; restartId?: unknown };
  if (typeof chatId !== 'string' || !chatId) return null;
  const checked = sdpOf(sdp, event === CALL_RESTART ? 'offer' : 'answer');
  if (!checked) return sdp === undefined && event === CALL_RESTART ? { chatId } : null;
  const id = restartIdOf(restartId);
  return id === undefined ? { chatId, sdp: checked } : { chatId, sdp: checked, restartId: id };
}

/** What the server does with a call signal besides relaying it to the chat's other members. */
export type CallSignalStep = 'ring' | 'answer' | 'candidate' | 'answering' | 'end' | 'relay';

const SIGNAL_STEPS: ReadonlyMap<string, CallSignalStep> = new Map([
  ['call.offer', 'ring'],
  ['call.answer', 'answer'],
  ['call.ice', 'candidate'],
  ['call.answering', 'answering'],
  ['call.end', 'end'],
  ['call.reject', 'end'],
]);

/** An ICE restart (or anything new) is only relayed: it must never ring, answer or end the call. */
export function callSignalStep(event: string): CallSignalStep {
  return SIGNAL_STEPS.get(event) ?? 'relay';
}
