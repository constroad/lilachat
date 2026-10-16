import * as SecureStore from 'expo-secure-store';

/**
 * La passphrase del respaldo (F12.1), en el llavero del teléfono.
 *
 * Se guarda para que el respaldo de fondo corra sin preguntar, como el de
 * WhatsApp. `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: el mismo criterio que la
 * credencial de sesión y la clave del almacén. **El server nunca la ve**, y
 * perderla es perder el respaldo: la interfaz lo dice al crearla.
 */
const CLAVE = 'lilachat.respaldo.passphrase';
const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function leerPassphrase(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CLAVE, OPCIONES);
  } catch {
    return null;
  }
}

export async function guardarPassphrase(passphrase: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(CLAVE, passphrase.trim(), OPCIONES);
    return true;
  } catch {
    return false;
  }
}

/** Al cerrar sesión: la passphrase es de la persona, no del teléfono que queda. */
export async function olvidarPassphrase(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLAVE, OPCIONES);
  } catch {
    // Igual que el resto del llavero: no poder borrar no rompe el cierre.
  }
}
