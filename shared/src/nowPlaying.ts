import { duracionDeVoz } from './notaDeVoz.js';

/**
 * The voice note that is playing for the whole session (backlog 34, José
 * 21/10: «el audio sigue sonando al salir del chat con una barra arriba»;
 * design `a-02-audio-en-curso`). One at a time; the app and the web keep it
 * outside the bubble, so leaving the chat does not cut it.
 */
export type NowPlaying = {
  /** `chatId:seq`: the bubble that plays it shows the same state. */
  id: string;
  chatId: string;
  authorName: string;
  authorPhoto?: string;
  playing: boolean;
  currentS: number;
  durationS: number;
  rate: number;
  loaded: boolean;
};

/** The bar shows outside the note's own chat while there is a note in the session, playing or paused; finished or closed, there is none. */
export function showsNowPlayingBar(now: NowPlaying | null, openChatId: string | null): boolean {
  return Boolean(now) && now?.chatId !== openChatId;
}

/** «Nota de voz · 0:24 de 1:12». */
export const nowPlayingLabel = (now: Pick<NowPlaying, 'currentS' | 'durationS'>): string => `Nota de voz · ${duracionDeVoz(now.currentS * 1000)} de ${duracionDeVoz(now.durationS * 1000)}`;

/** 0→1: how far it went, for the thin line under the bar. */
export function nowPlayingProgress(now: Pick<NowPlaying, 'currentS' | 'durationS'>): number {
  return now.durationS > 0 ? Math.min(1, Math.max(0, now.currentS / now.durationS)) : 0;
}

type VoiceQueueRow = { seq?: number; media?: { url?: string; mime?: string } | null };

/**
 * The note that plays when `finishedId` ends, like WhatsApp's consecutive voice
 * notes (José, 04/11): only the very next message, and only if it is a voice
 * note too, so a text in between ends the run. A note that is not in `rows`
 * (another chat, a thread of this one) has no next.
 */
export function nextVoiceMessage<Row extends VoiceQueueRow>(rows: readonly Row[], finishedId: string, chatId: string): Row | null {
  const [owner, seqText] = finishedId.split(':');
  if (owner !== chatId) return null;
  const seq = Number(seqText);
  let listed = false;
  let next: Row | null = null;
  for (const row of rows) {
    if (row.seq === seq) listed = true;
    else if (row.seq !== undefined && row.seq > seq && (next?.seq === undefined || row.seq < next.seq)) next = row;
  }
  return listed && next?.media?.url && next.media.mime?.startsWith('audio/') ? next : null;
}
