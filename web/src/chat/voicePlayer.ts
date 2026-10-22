import { useSyncExternalStore } from 'react';
import type { NowPlaying } from '@lilachat/shared';

/**
 * The voice note that plays for the whole web session, like the app's
 * (backlog 34; `shared/nowPlaying.ts`): ONE <audio> outside React, so
 * opening another chat does not cut it. The bubble and the bar above the
 * list (`NowPlayingBar`) read the same state.
 */
let element: HTMLAudioElement | null = null;
let current: NowPlaying | null = null;
const listeners = new Set<() => void>();

function publish(next: NowPlaying | null): void {
  current = next;
  listeners.forEach((listener) => listener());
}

const durationOf = (audio: HTMLAudioElement, fallback: number) => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallback);

/** The one <audio>, created on the first note; its own events say what it is doing. */
function audio(): HTMLAudioElement {
  if (element) return element;
  const created = new Audio();
  const sync = (change: Partial<NowPlaying> = {}) => current && publish({ ...current, currentS: created.currentTime, durationS: durationOf(created, current.durationS), ...change });
  created.addEventListener('timeupdate', () => sync());
  created.addEventListener('loadedmetadata', () => sync({ loaded: true }));
  created.addEventListener('play', () => sync({ playing: true }));
  created.addEventListener('pause', () => sync({ playing: false }));
  // Finished: it goes, like WhatsApp; the bubble is back at the start and the bar hides.
  created.addEventListener('ended', () => publish(null));
  element = created;
  return created;
}

/** Plays a note; if it is the one already loaded, it goes on from where it was. */
export function playVoiceNote(note: { id: string; chatId: string; url: string; authorName: string; durationS: number; rate: number; startShare: number | null }): void {
  const player = audio();
  if (current?.id === note.id) return toggleVoiceNote();
  player.pause();
  player.src = note.url;
  player.playbackRate = note.rate;
  publish({ id: note.id, chatId: note.chatId, authorName: note.authorName, playing: false, currentS: 0, durationS: note.durationS, rate: note.rate, loaded: false });
  if (note.startShare) player.currentTime = note.startShare * note.durationS;
  void player.play().catch(() => current && publish({ ...current, playing: false }));
}

export function toggleVoiceNote(): void {
  if (!element || !current) return;
  if (current.playing) return element.pause();
  void element.play().catch(() => current && publish({ ...current, playing: false }));
}

export function seekVoiceNote(share: number): void {
  if (!element || !current) return;
  element.currentTime = share * current.durationS;
  publish({ ...current, currentS: share * current.durationS });
}

export function setVoiceNoteRate(rate: number): void {
  if (!element || !current) return;
  element.playbackRate = rate;
  publish({ ...current, rate });
}

/** The X of the bar: it stops and forgets the note. */
export function stopVoiceNote(): void {
  element?.pause();
  publish(null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** What is playing now, for the bubble and the bar. */
export const useNowPlaying = (): NowPlaying | null => useSyncExternalStore(subscribe, () => current);

/** Tests only: a new <audio> and nothing playing. */
export function resetVoicePlayerForTests(): void {
  element = null;
  current = null;
}
