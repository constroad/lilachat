import { createPrefStore } from '../../ui/prefStore';

/** The camera's «Logo» chip (José 12/11): on until turned off, remembered on the device. */
const store = createPrefStore<boolean>('lilachat.pref.cameraLogo', (stored) => stored !== '0', true, (value) => (value ? '1' : '0'));
export const useCameraLogo = store.use;
export const setCameraLogo = store.set;
