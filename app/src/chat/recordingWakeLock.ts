/** Its own keep-awake tag (backlog 115): the updater holds `lilachat-update` and neither lets the other's go. */
export const RECORDING_KEEP_AWAKE_TAG = 'voice-note';

type KeepAwake = { activate: (tag: string) => Promise<unknown>; deactivate: (tag: string) => Promise<unknown> };

/**
 * The screen stays on while a voice note records (backlog 115, José 28/10: a
 * minute of recording and the phone had locked before sending). Pure, with
 * `expo-keep-awake` injected: hold at start, release on send, cancel or
 * leaving. Idempotent, and a failure never reaches the recording.
 */
export function createRecordingWakeLock(keepAwake: KeepAwake) {
  let held = false;
  return {
    hold(): void {
      if (held) return;
      held = true;
      void keepAwake.activate(RECORDING_KEEP_AWAKE_TAG).catch((error: unknown) => console.warn('[voz] keep-awake:', error instanceof Error ? error.message : error));
    },
    release(): void {
      if (!held) return;
      held = false;
      void keepAwake.deactivate(RECORDING_KEEP_AWAKE_TAG).catch((error: unknown) => console.warn('[voz] keep-awake:', error instanceof Error ? error.message : error));
    },
  };
}
