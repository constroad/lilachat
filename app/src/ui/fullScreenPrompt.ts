import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Full-screen calls can come back denied after an update (José, 22/10: «cada
 * vez que actualizo se desactiva»; seen on his Samsung, not on the emulator,
 * where the appop survives `install -r`). The Settings card alone was not
 * enough: nobody goes to Settings after updating. So the app asks once per
 * version, only while they are denied, and «Ahora no» holds until the next one.
 */
export function shouldAskFullScreen(state: { allowed: boolean; version: string; askedForVersion: string | null }): boolean {
  if (state.allowed || !state.version) return false;
  return state.askedForVersion !== state.version;
}

const ASKED_KEY = 'lilachat.fullscreen.askedForVersion';

export const askedForVersion = (): Promise<string | null> => AsyncStorage.getItem(ASKED_KEY).catch(() => null);

export async function markAsked(version: string): Promise<void> {
  await AsyncStorage.setItem(ASKED_KEY, version).catch(() => undefined);
}
