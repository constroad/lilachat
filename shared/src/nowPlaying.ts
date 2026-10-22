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
