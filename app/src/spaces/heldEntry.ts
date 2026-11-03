/**
 * What a list shows while a chat covers it (plan 1, F4). PURE.
 *
 * On Fabric, React Navigation never freezes the screen right below the focused
 * one (`isBelowFocused`), so `freezeOnBlur` did nothing and the space list
 * re-rendered with every message of the open chat. Held, the list keeps the
 * very same entry: updates land in the cache and show when the chat closes.
 */
export type ShownEntry<T> = { key: string; entry: T };

export function entryWhileHeld<T>(held: boolean, shown: ShownEntry<T> | null, key: string, current: T): ShownEntry<T> {
  if (held && shown && shown.key === key) return shown;
  return { key, entry: current };
}
