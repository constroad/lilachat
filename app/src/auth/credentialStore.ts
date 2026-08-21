import * as SecureStore from 'expo-secure-store';

/**
 * La credencial del dispositivo, en el llavero del sistema — jamás en
 * AsyncStorage (rn-app-loop §3). `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: no viaja en
 * backups de Android ni a otro equipo.
 */
const KEY = 'lilachat-credential';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type Credential = {
  /** Id del usuario en Lilachat: decide qué burbuja es propia. */
  userId: string;
  deviceId: string;
  deviceSecret: string;
  jwt: string;
  phone: string;
  name: string | null;
};

export async function saveCredential(credential: Credential): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(credential), OPTIONS);
}

export async function loadCredential(): Promise<Credential | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credential;
  } catch {
    return null;
  }
}

export async function clearCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}
