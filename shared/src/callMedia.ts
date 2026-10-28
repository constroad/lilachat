import { CALL_TIMEOUT_MS, formatCallDuration, type CallState } from './call.js';

/**
 * Whether the audio flows, apart from whether the call was answered (FL8).
 * `call.ts` knows the SIGNAL (it rang, they answered, they hung up); ICE
 * decides the audio, which can take seconds or never come. Pure: it takes the
 * `iceConnectionState` as text, so the app (react-native-webrtc) and the web
 * (the browser's RTCPeerConnection) read it the same. The values are the
 * Spanish words the app already used, like `CallState`'s phases.
 */
export type MediaState = 'conectando' | 'conectada' | 'reconectando' | 'fallo';

export function mediaState(ice: string, connectedBefore: boolean): MediaState {
  if (ice === 'connected' || ice === 'completed') return 'conectada';
  if (ice === 'failed') return 'fallo';
  // `closed` comes from whoever hangs up; it is not news from the network.
  if (ice === 'closed') return connectedBefore ? 'conectada' : 'conectando';
  return connectedBefore ? 'reconectando' : 'conectando';
}

/**
 * How long to wait for the audio to flow (or come back) before hanging up.
 * ICE only reaches `failed` after trying the other side's candidates; with
 * none it stays «connecting» forever (80 s in an E2E until hung up by hand).
 */
export const CONNECT_WAIT_MS = 30_000;

export function waitBeforeGivingUp(media: MediaState): number | null {
  return media === 'conectando' || media === 'reconectando' ? CONNECT_WAIT_MS : null;
}

/** The line under the name on the call screen. */
export function callCaption(params: { state: CallState; media: MediaState; video: boolean; now: number }): string {
  const { state, media } = params;
  // Backlog 114: once answering, both sides read «Conectando…» until the answer lands.
  if ((state.fase === 'llamando' || state.fase === 'sonando') && state.answeringAt !== undefined) return 'Conectando…';
  if (state.fase === 'llamando') return 'Llamando…';
  if (state.fase === 'sonando') return params.video ? 'Videollamada entrante' : 'Llamada entrante';
  if (state.fase === 'terminada') {
    if (state.motivo === 'desconectada') return 'No se pudo conectar';
    return state.motivo === 'ocupado' ? 'Ocupado en otra llamada' : 'Llamada terminada';
  }
  if (media === 'conectando') return 'Conectando…';
  if (media === 'reconectando') return 'Reconectando…';
  return formatCallDuration(state, params.now);
}

/**
 * When an offer started ringing, from what the server says is LEFT of it. An
 * offer delivered late (a device that connected while it rang) does not ring
 * another 30 s: the server would call it missed while it is being answered.
 */
export function ringStart(remainingMs: number | undefined, now: number): number {
  if (typeof remainingMs !== 'number' || !Number.isFinite(remainingMs)) return now;
  const left = Math.min(CALL_TIMEOUT_MS, Math.max(0, remainingMs));
  return now - (CALL_TIMEOUT_MS - left);
}

/** Who is calling: the chat's name (the agenda's), then the name the offer brings, then the phone. */
export function callerName(params: { chatName?: string | null; fromName?: string | null; fromPhone?: string | null }): string {
  return params.chatName || params.fromName || params.fromPhone || 'Alguien';
}

/** Front or rear camera in a video call (pending 97). */
export type CameraFacing = 'user' | 'environment';

export const otherFacing = (facing: CameraFacing): CameraFacing => (facing === 'user' ? 'environment' : 'user');

/** My own view is mirrored only with the front camera, like WhatsApp: the rear one shows the world as it is. */
export const mirrorsSelfView = (facing: CameraFacing): boolean => facing === 'user';

/** The switch only shows with two cameras: a laptop has one, a phone two. */
export const canSwitchCamera = (videoInputs: number): boolean => videoInputs > 1;

/**
 * Whether a camera switch may start now (0.1.172 crash reports, 28/10): the
 * native side throws «camera is not running» with the video off or ended, and
 * «Camera switch already in progress» on a second tap before the first ends.
 */
export function cameraSwitchAllowed(params: { track: { enabled: boolean; readyState: string } | null | undefined; switching: boolean }): boolean {
  return !params.switching && Boolean(params.track?.enabled) && params.track?.readyState === 'live';
}

/** Those two answers are a tap at the wrong time, not a failure: nothing to report. */
export function isBenignCameraSwitchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /camera is not running|switch already in progress/i.test(message);
}
