import { describe, expect, it, vi } from 'vitest';
import { RECORDING_KEEP_AWAKE_TAG, createRecordingWakeLock } from './recordingWakeLock';

/**
 * Backlog 115 (José, 28/10):
 * «a veces grabo 1 min y para cuando quiero enviar ya la pantalla está bloqueada».
 * The screen stays on while a voice note records, and only then: its own tag,
 * so the updater's lock is not touched.
 */
describe('createRecordingWakeLock', () => {
  const setup = () => {
    const activate = vi.fn(async (_tag: string) => undefined);
    const deactivate = vi.fn(async (_tag: string) => undefined);
    return { activate, deactivate, lock: createRecordingWakeLock({ activate, deactivate }) };
  };

  it('holds the screen on while recording and lets it go on send or cancel', () => {
    const { activate, deactivate, lock } = setup();

    lock.hold();
    lock.release();

    expect(activate).toHaveBeenCalledWith(RECORDING_KEEP_AWAKE_TAG);
    expect(deactivate).toHaveBeenCalledWith(RECORDING_KEEP_AWAKE_TAG);
  });

  it('holding twice asks once; releasing what is not held does nothing (leaving the chat without recording)', () => {
    const { activate, deactivate, lock } = setup();

    lock.release();
    lock.hold();
    lock.hold();
    lock.release();
    lock.release();

    expect(activate).toHaveBeenCalledTimes(1);
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('a failing keep-awake never breaks the recording', async () => {
    const lock = createRecordingWakeLock({ activate: async () => Promise.reject(new Error('no activity')), deactivate: async () => Promise.reject(new Error('gone')) });

    expect(() => lock.hold()).not.toThrow();
    expect(() => lock.release()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('its own tag, not the updater one', () => {
    expect(RECORDING_KEEP_AWAKE_TAG).toBe('voice-note');
  });
});
