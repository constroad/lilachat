/**
 * How many modals cover the app right now (José, 20/10: «a user replies in a
 * thread, goes back and lands at the start of the conversation»).
 *
 * On Android, a modal that opens sends a keyboard event with no start. The
 * conversation's keyboard-following scroll behind it answered with a jump to
 * the position it kept from the last keyboard (offset 0 the first time: the
 * start of the chat). It happened with every modal over the chat (thread,
 * clip, details, viewer…). The lists that follow the keyboard freeze while a
 * modal covers them; see `useScrollConTeclado`.
 */
type Listener = () => void;

let openCount = 0;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

/** Counts one modal as open; the returned function releases it (only once). */
export function openOverlay(): () => void {
  openCount += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount -= 1;
    notify();
  };
}

export const openOverlays = () => openCount;

export function subscribeOverlays(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A list that lives inside `level` modals follows the keyboard only while nothing opens above it. */
export const coveredAbove = (level: number, open: number = openCount) => open > level;
