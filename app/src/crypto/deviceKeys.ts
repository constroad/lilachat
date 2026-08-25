import * as SecureStore from 'expo-secure-store';
import {
  advanceChain,
  base64ToBytes,
  bytesToBase64,
  decryptMessage,
  deriveSessionRoot,
  encryptMessage,
  generateIdentity,
  publicFromPrivate,
  publicKeyFingerprint,
  type Envelope,
} from '@lilachat/shared';

/**
 * Las claves de ESTE teléfono (F9).
 *
 * La privada vive en `expo-secure-store` con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`,
 * igual que la credencial de sesión: en el llavero del sistema, sin salir del
 * aparato y sin viajar en ningún respaldo del sistema operativo. Que la privada
 * NUNCA salga es la única razón por la que el server no puede leer.
 *
 * **Consecuencia que hay que decir, no esconder**: si se pierde el teléfono, se
 * pierden los chats secretos. No hay recuperación posible — si la hubiera,
 * también la tendría quien se quede con el aparato.
 */
const CLAVE_PRIVADA = 'lilachat.e2ee.private';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

// Del motor: el mismo base64 en el teléfono, la web y el server.
const b64 = bytesToBase64;
const unb64 = base64ToBytes;

/**
 * La identidad del dispositivo, creándola la primera vez.
 *
 * Es idempotente a propósito: llamarla dos veces no genera dos pares. Si lo
 * hiciera, el segundo par dejaría ilegible todo lo cifrado con el primero.
 */
export async function ensureIdentity(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  const guardada = await SecureStore.getItemAsync(CLAVE_PRIVADA);
  if (guardada) {
    const privateKey = unb64(guardada);
    return { privateKey, publicKey: publicFromPrivate(privateKey) };
  }

  const identidad = generateIdentity();
  await SecureStore.setItemAsync(CLAVE_PRIVADA, b64(identidad.privateKey), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return identidad;
}

/** Publica la clave pública para que puedan escribirme cifrado. */
export async function publishPublicKey(jwt: string): Promise<boolean> {
  const { publicKey } = await ensureIdentity();
  try {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ publicKey: b64(publicKey) }),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchPublicKey(
  jwt: string,
  userId: string
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/keys/${userId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { devices: { publicKey: string }[] };
    // El primero por ahora: multi-dispositivo cifrado necesita un sobre por
    // dispositivo, y eso es trabajo aparte — está anotado en el spec.
    const clave = data.devices[0]?.publicKey;
    return clave ? unb64(clave) : null;
  } catch {
    return null;
  }
}

/**
 * Cifra para una conversación secreta.
 *
 * La cadena arranca de la raíz en cada mensaje **por ahora**: guardar el estado
 * del ratchet entre reinicios es lo que falta para tener forward secrecy de
 * verdad en el uso real, y está anotado como pendiente. Con esto ya se cumple
 * lo esencial —el server no puede leer— sin fingir que es Signal.
 */
export function sealFor(theirPublicKey: Uint8Array, privateKey: Uint8Array, text: string): Envelope {
  const raiz = deriveSessionRoot({ myPrivateKey: privateKey, theirPublicKey });
  return encryptMessage(advanceChain(raiz).messageKey, text);
}

export function openFrom(
  theirPublicKey: Uint8Array,
  privateKey: Uint8Array,
  envelope: Envelope
): string | null {
  try {
    const raiz = deriveSessionRoot({ myPrivateKey: privateKey, theirPublicKey });
    return decryptMessage(advanceChain(raiz).messageKey, envelope);
  } catch {
    // Un sobre que no abre NO se muestra como texto vacío: la pantalla tiene
    // que poder decir «no se pudo descifrar», que es información real.
    return null;
  }
}

export const fingerprintWith = (mine: Uint8Array, theirs: Uint8Array): string =>
  publicKeyFingerprint(mine, theirs);
