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
  // **`getItemAsync` puede LANZAR, no solo devolver null.** En Android el valor
  // va cifrado con una llave del Keystore que se puede invalidar tras ciertos
  // reinicios o cambios de seguridad; ahi tira «Could not decrypt the value» en
  // vez de contestar null. Sin este try/catch la excepcion sube al arranque
  // (`start()`), queda sin manejar y la app se cuelga o rebota a la puerta sin
  // decir por que (Jose, 30/08/2026: «cada vez que se reinicia se borra la
  // sesion»). Un valor que no descifra ya no sirve: se BORRA para no volver a
  // chocar con lo mismo, y se cae a la puerta limpio, no colgado.
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  } catch {
    await SecureStore.deleteItemAsync(KEY, OPTIONS).catch(() => {});
    return null;
  }
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
