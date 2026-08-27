import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { abrirCache, bytesToBase64, base64ToBytes, cerrarCache, recortarParaCache } from '@lilachat/shared';
import type { ChatMessage } from './useChat';

/**
 * Los mensajes de cada chat, guardados en el teléfono y CIFRADOS en reposo.
 *
 * Es lo que hace la app local-first: abrir un chat pinta lo guardado al instante
 * y el socket confirma o corrige por detrás.
 *
 * **La clave vive en `expo-secure-store`** con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`:
 * el mismo criterio que la credencial de sesión. En AsyncStorage —que es un
 * archivo legible— iría la caja fuerte junto a su llave.
 *
 * **Nada de esto lanza.** Perder la caché cuesta esperar a la red una vez; que
 * el chat no abra por un archivo corrupto sería mucho peor.
 */
const CLAVE_SECRETA = 'lilachat.cacheKey';
const PREFIJO = 'lilachat.msgs.';

const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** La clave de la caché; se crea la primera vez y no cambia nunca más. */
async function claveDeCache(): Promise<Uint8Array | null> {
  try {
    const guardada = await SecureStore.getItemAsync(CLAVE_SECRETA, OPCIONES);
    if (guardada) return base64ToBytes(guardada);

    const nueva = Crypto.getRandomBytes(32);
    await SecureStore.setItemAsync(CLAVE_SECRETA, bytesToBase64(nueva), OPCIONES);
    return nueva;
  } catch {
    // Sin llavero no se guarda nada: preferible perder la caché a escribir los
    // mensajes en claro.
    return null;
  }
}

export async function leerMensajesGuardados(chatId: string): Promise<ChatMessage[] | null> {
  try {
    const clave = await claveDeCache();
    if (!clave) return null;

    const crudo = await AsyncStorage.getItem(`${PREFIJO}${chatId}`);
    if (!crudo) return null;

    const mensajes = abrirCache<ChatMessage[]>(clave, JSON.parse(crudo));
    return Array.isArray(mensajes) ? mensajes : null;
  } catch {
    return null;
  }
}

export async function guardarMensajes(chatId: string, mensajes: ChatMessage[]): Promise<void> {
  try {
    const clave = await claveDeCache();
    if (!clave) return;

    const sobre = cerrarCache(clave, recortarParaCache(mensajes));
    await AsyncStorage.setItem(`${PREFIJO}${chatId}`, JSON.stringify(sobre));
  } catch {
    // Deliberado: no poder guardar no puede romper el chat.
  }
}

/**
 * Al cerrar sesión se borra TODO, incluida la clave.
 *
 * Sin borrar la clave, los archivos quedarían descifrables por quien entre
 * después en ese teléfono; sin borrar los archivos, quedaría el historial de
 * alguien que ya se fue.
 */
export async function olvidarMensajes(): Promise<void> {
  try {
    const claves = await AsyncStorage.getAllKeys();
    const mias = claves.filter((clave) => clave.startsWith(PREFIJO));
    if (mias.length > 0) await AsyncStorage.multiRemove(mias);
    await SecureStore.deleteItemAsync(CLAVE_SECRETA, OPCIONES);
  } catch {
    // Igual que arriba.
  }
}
