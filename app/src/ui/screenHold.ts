export type KeepAwake = { activate: (tag: string) => Promise<unknown>; deactivate: (tag: string) => Promise<unknown> };

/**
 * The screen stays on under one tag, with `expo-keep-awake` injected so it can
 * be tested. Idempotent, and a failure only warns: what asked for it (a voice
 * note, a call) goes on with a screen that locks.
 */
export function createScreenHold(tag: string, keepAwake: KeepAwake) {
  let held = false;
  const warn = (error: unknown) => console.warn(`[keep-awake] ${tag}:`, error instanceof Error ? error.message : error);
  return {
    hold(): void {
      if (held) return;
      held = true;
      void keepAwake.activate(tag).catch(warn);
    },
    release(): void {
      if (!held) return;
      held = false;
      void keepAwake.deactivate(tag).catch(warn);
    },
  };
}
