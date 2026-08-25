import { gcm } from '@noble/ciphers/aes.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

/**
 * Cifrado extremo a extremo de los chats secretos (F9).
 *
 * **POR QUÉ NO libsignal.** El plan lo nombraba, y libsignal-client es una
 * librería nativa: en React Native obliga a un módulo propio por plataforma y a
 * mantenerlo build tras build. Acá se usan las mismas primitivas que Signal
 * —X25519 para el acuerdo, HKDF para derivar, AES-GCM para el sobre— con
 * `@noble`, que es JavaScript puro y auditado, y corre igual en el teléfono, en
 * la web y en Node. Se gana que el MISMO código cifra en los tres lados; se
 * pierde el doble ratchet completo de Signal, que es una diferencia real y está
 * escrita abajo.
 *
 * **QUÉ PROTEGE Y QUÉ NO.** Protege el contenido frente a cualquiera que llegue
 * a la base o al disco del servidor: ahí solo hay sobres. No esconde QUIÉN le
 * escribe a quién ni CUÁNDO —los metadatos siguen en claro, porque el server
 * necesita repartir— y no protege un teléfono desbloqueado en manos ajenas.
 *
 * **LO QUE APAGA**, y por eso el cifrado es POR CONVERSACIÓN y opt-in:
 *  · Lila no puede resumir un chat secreto (F8): el server no ve el texto.
 *  · El respaldo guarda sobres (F7): se restauran, pero solo los abre quien
 *    tenga las claves del dispositivo.
 *  · La búsqueda del server no lo alcanza; solo se busca lo que está en el
 *    teléfono.
 * Un chat normal conserva las tres cosas. Decirlo en la interfaz es parte de la
 * función: prometer cifrado y además resumen automático sería mentir.
 *
 * **RATCHET SIMÉTRICO, no doble.** La cadena avanza en cada mensaje, así que la
 * clave de uno no abre los anteriores (forward secrecy). Lo que NO hay todavía
 * es el paso DH periódico de Signal: quien robe el estado actual puede seguir
 * leyendo lo que venga hasta que la sesión se rehaga. Se documenta porque es la
 * diferencia entre esto y Signal, y no se dibuja en la interfaz como si fuera
 * lo mismo.
 */

export type Identity = { privateKey: Uint8Array; publicKey: Uint8Array };

/** El par de claves del DISPOSITIVO. La privada nunca sale de él. */
export function generateIdentity(): Identity {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: publicFromPrivate(privateKey) };
}

/**
 * La pública se DERIVA de la privada, así que solo se guarda una.
 *
 * Guardar las dos invita a que se desincronicen: basta un error al restaurar
 * para quedar publicando una pública que no corresponde a la privada, y el
 * síntoma sería «nadie puede leerme» sin ninguna pista de por qué.
 */
export const publicFromPrivate = (privateKey: Uint8Array): Uint8Array =>
  x25519.getPublicKey(privateKey);

// Las etiquetas van en BYTES: esta versión de `hkdf` no acepta string en
// `info` y falla en tiempo de ejecución, no de compilación.
const etiqueta = (texto: string): Uint8Array => new TextEncoder().encode(texto);
const INFO_ROOT = etiqueta('lilachat-e2ee-root-v1');
const INFO_MESSAGE = etiqueta('lilachat-e2ee-msg-v1');
const INFO_NEXT = etiqueta('lilachat-e2ee-chain-v1');

/**
 * La raíz de la sesión, que las dos partes calculan por su cuenta.
 *
 * El secreto compartido de X25519 no se usa CRUDO como clave: se pasa por HKDF
 * con una etiqueta propia. Así, si mañana estas mismas claves sirven para otra
 * cosa, las claves derivadas no se pisan entre usos.
 */
export function deriveSessionRoot(params: {
  myPrivateKey: Uint8Array;
  theirPublicKey: Uint8Array;
}): Uint8Array {
  const shared = x25519.getSharedSecret(params.myPrivateKey, params.theirPublicKey);
  return hkdf(sha256, shared, undefined, INFO_ROOT, 32);
}

/**
 * Un paso de la cadena: la clave de ESTE mensaje y la cadena para el siguiente.
 *
 * Las dos salen del mismo estado pero con etiquetas distintas, así que tener la
 * clave del mensaje no da la cadena — que es lo que impide que abrir un mensaje
 * abra toda la conversación futura.
 */
export function advanceChain(chain: Uint8Array): {
  messageKey: Uint8Array;
  nextChain: Uint8Array;
} {
  return {
    messageKey: hkdf(sha256, chain, undefined, INFO_MESSAGE, 32),
    nextChain: hkdf(sha256, chain, undefined, INFO_NEXT, 32),
  };
}

/** Lo que se guarda y viaja. Ni un campo con texto plano. */
export type Envelope = { v: 1; nonce: string; ciphertext: string };

/**
 * Base64 a mano, y no `Buffer`.
 *
 * Este módulo corre en los TRES lados —Node, el navegador y Hermes— y `Buffer`
 * solo existe en Node. `btoa` tampoco está garantizado en Hermes. Son quince
 * líneas y evitan un polyfill que habría que mantener en la app y en la web.
 */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let salida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    salida += ALFABETO[a >> 2];
    salida += ALFABETO[((a & 3) << 4) | ((b ?? 0) >> 4)];
    salida += b === undefined ? '=' : ALFABETO[((b & 15) << 2) | ((c ?? 0) >> 6)];
    salida += c === undefined ? '=' : ALFABETO[c & 63];
  }
  return salida;
}

export function base64ToBytes(value: string): Uint8Array {
  const limpio = value.replace(/=+$/, '');
  const bytes = new Uint8Array((limpio.length * 3) >> 2);
  let posicion = 0;
  let acumulado = 0;
  let bits = 0;
  for (const caracter of limpio) {
    const indice = ALFABETO.indexOf(caracter);
    if (indice === -1) throw new Error('base64 inválido');
    acumulado = (acumulado << 6) | indice;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[posicion++] = (acumulado >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, posicion);
}

const b64 = bytesToBase64;
const unb64 = base64ToBytes;

export function encryptMessage(messageKey: Uint8Array, plaintext: string): Envelope {
  // Nonce ALEATORIO por mensaje: con uno fijo, dos textos iguales darían
  // sobres idénticos y se vería cuándo alguien repite algo sin poder leerlo.
  const nonce = randomBytes(12);
  const sealed = gcm(messageKey, nonce).encrypt(new TextEncoder().encode(plaintext));
  return { v: 1, nonce: b64(nonce), ciphertext: b64(sealed) };
}

/**
 * Abre el sobre. **Lanza si no cuadra**, y eso es deliberado: AES-GCM autentica,
 * así que un mensaje alterado en la base no se descifra a basura — se rechaza.
 * Devolver un texto vacío en vez de fallar dejaría pasar contenido manipulado
 * como si fuera un mensaje real.
 */
export function decryptMessage(messageKey: Uint8Array, envelope: Envelope): string {
  const opened = gcm(messageKey, unb64(envelope.nonce)).decrypt(unb64(envelope.ciphertext));
  return new TextDecoder().decode(opened);
}

/**
 * La huella para verificar en persona o por teléfono.
 *
 * Ordenada, para que salga IGUAL en los dos teléfonos sin importar quién la
 * mire — si dependiera del orden, cada uno vería una distinta y la comparación
 * no serviría para nada. En grupos de cinco dígitos porque se lee en voz alta.
 */
export function publicKeyFingerprint(a: Uint8Array, b: Uint8Array): string {
  const [uno, otro] = [b64(a), b64(b)].sort();
  const digest = sha256(new TextEncoder().encode(`${uno}|${otro}`));

  const grupos: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const trozo = digest.slice(index * 4, index * 4 + 4);
    const numero = ((trozo[0]! << 24) >>> 0) + (trozo[1]! << 16) + (trozo[2]! << 8) + trozo[3]!;
    grupos.push(String(numero % 100000).padStart(5, '0'));
  }
  return grupos.join(' ');
}
