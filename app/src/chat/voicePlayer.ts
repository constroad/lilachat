import { useSyncExternalStore } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { firstPlay, type NowPlaying } from '@lilachat/shared';
import { soltarElAudio, tomarElAudio } from './notaDeVozMotor';
import { playbackAudioMode } from './audioMode';
import { reportarError } from '../ui/reportarError';
import { releasePlayer } from './releasePlayer';

/** Longer than this, Android stops background audio after ~3 min unless it shows lock-screen controls. */
const LOCK_SCREEN_FROM_S = 150;
/** How often the position updates: the bar and the bubble move smoothly without a render per frame. */
const STATUS_EVERY_MS = 250;

type Session = { player: AudioPlayer; stop: () => void; started: boolean; startShare: number | null };

/**
 * The voice note that plays for the whole session (backlog 34, José 21/10:
 * «el audio sigue sonando al salir del chat con una barra arriba»). Before,
 * the player lived in the bubble and leaving the chat unmounted it. Now there
 * is ONE player outside React; the bubble and the bar (`NowPlayingBar`) read
 * the same state (`shared/nowPlaying.ts`).
 */
let session: Session | null = null;
let current: NowPlaying | null = null;
const listeners = new Set<() => void>();

function publish(next: NowPlaying | null): void {
  current = next;
  listeners.forEach((listener) => listener());
}

/** Plays with the screen locked (20/10); a long audio also gets lock-screen controls so Android does not cut it. */
function playInBackground(player: AudioPlayer, durationS: number): void {
  void setAudioModeAsync(playbackAudioMode()).catch((error) => reportarError('nota.audioMode', error));
  if (durationS >= LOCK_SCREEN_FROM_S) player.setActiveForLockScreen(true, { title: 'Nota de voz' });
  player.play();
}

function onStatus(status: AudioStatus): void {
  if (!session || !current) return;
  const durationS = status.duration > 0 ? status.duration : current.durationS;
  // The tap asked to play: once loaded (Android ignores an earlier play), from where it was touched.
  const decision = firstPlay({ loaded: status.isLoaded, started: session.started, startShare: session.startShare, duration: durationS });
  if (decision.play) {
    session.started = true;
    if (decision.seekTo > 0) void session.player.seekTo(decision.seekTo);
    session.player.setPlaybackRate(current.rate);
    playInBackground(session.player, durationS);
  }
  // Finished: it goes, like WhatsApp; the bubble is back at the start and the bar hides.
  if (status.didJustFinish) return stopVoiceNote();
  publish({ ...current, playing: status.playing, currentS: status.currentTime, durationS, loaded: status.isLoaded });
}

/** Plays a note; if it is the one already loaded, it goes on from where it was. */
export function playVoiceNote(note: { id: string; url: string; authorName: string; authorPhoto?: string; durationS: number; rate: number; startShare: number | null }): void {
  if (session && current?.id === note.id) return toggleVoiceNote();
  stopVoiceNote();
  const player = createAudioPlayer(note.url, { updateInterval: STATUS_EVERY_MS });
  const subscription = player.addListener('playbackStatusUpdate', onStatus);
  session = { player, started: false, startShare: note.startShare, stop: () => subscription.remove() };
  tomarElAudio(note.id, () => session?.player.pause());
  publish({ id: note.id, chatId: note.id.split(':')[0] ?? '', authorName: note.authorName, authorPhoto: note.authorPhoto, playing: false, currentS: 0, durationS: note.durationS, rate: note.rate, loaded: false });
}

export function toggleVoiceNote(): void {
  if (!session || !current) return;
  if (current.playing) return session.player.pause();
  if (current.currentS >= current.durationS && current.durationS > 0) void session.player.seekTo(0);
  tomarElAudio(current.id, () => session?.player.pause());
  session.player.setPlaybackRate(current.rate);
  playInBackground(session.player, current.durationS);
}

export function seekVoiceNote(share: number): void {
  if (!session || !current) return;
  void session.player.seekTo(share * current.durationS);
  publish({ ...current, currentS: share * current.durationS });
}

export function setVoiceNoteRate(rate: number): void {
  if (!session || !current) return;
  session.player.setPlaybackRate(rate);
  publish({ ...current, rate });
}

/** The X of the bar, the end of the note, or another note starting: the player is released. */
export function stopVoiceNote(): void {
  if (session) {
    session.stop();
    releasePlayer(session.player, (error) => reportarError('nota.soltar', error));
  }
  if (current) soltarElAudio(current.id);
  session = null;
  publish(null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** What is playing now, for the bubble and the bar. */
export const useNowPlaying = (): NowPlaying | null => useSyncExternalStore(subscribe, () => current);
