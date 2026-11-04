import { createScreenHold, type KeepAwake } from '../ui/screenHold';

/** Its own keep-awake tag (backlog 115): the updater holds `lilachat-update` and neither lets the other's go. */
export const RECORDING_KEEP_AWAKE_TAG = 'voice-note';

/**
 * The screen stays on while a voice note records (backlog 115, José 28/10: a
 * minute of recording and the phone had locked before sending): hold at start,
 * release on send, cancel or leaving.
 */
export const createRecordingWakeLock = (keepAwake: KeepAwake) => createScreenHold(RECORDING_KEEP_AWAKE_TAG, keepAwake);
