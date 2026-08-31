import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * El identificador ESTABLE de este teléfono.
 *
 * Antes cada login generaba un `deviceId` nuevo (`Crypto.randomUUID()` en el
 * verify), así que un usuario que perdía la sesión y volvía a entrar dejaba un
 * dispositivo huérfano cada vez —José tenía 8—. El enrolamiento del server hace
 * upsert por `{deviceId, app}`: con un id estable, re-loguear REUSA el mismo
 * dispositivo (nuevo secreto, misma fila) en vez de multiplicarlos.
 *
 * Vive en AsyncStorage y NO en el llavero: no es un secreto —es un nombre— y el
 * llavero es justo lo que se puede quedar sin descifrar tras un reinicio, que es
 * lo que arrastraba la sesión. Un id de dispositivo perdido no cuesta nada: se
 * crea otro. La credencial (con el secreto) sí va en el llavero.
 */
const CLAVE = 'lilachat.deviceId';

export async function obtenerDeviceIdEstable(): Promise<string> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE);
    if (guardado) return guardado;
  } catch {
    /* si no se pudo leer, se genera uno nuevo: peor es no poder entrar */
  }
  const nuevo = Crypto.randomUUID();
  await AsyncStorage.setItem(CLAVE, nuevo).catch(() => {});
  return nuevo;
}
