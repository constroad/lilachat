import * as Crypto from 'expo-crypto';

/**
 * `crypto.getRandomValues` para Hermes.
 *
 * Las librerías de criptografía —`@noble`, y cualquier otra seria— piden el
 * generador aleatorio del ESTÁNDAR WebCrypto, y Hermes no lo trae. Sin esto la
 * app arranca bien y revienta con «crypto.getRandomValues must be defined»
 * recién al crear una clave o un nonce, o sea al abrir el primer chat secreto.
 *
 * Se enchufa el de `expo-crypto`, que sale del generador del sistema operativo.
 * **Nunca un `Math.random` de reemplazo**: sería predecible, y un nonce
 * predecible en AES-GCM rompe el cifrado entero — un fallback silencioso acá
 * sería peor que el error.
 *
 * Se importa PRIMERO en `App.tsx`, antes que cualquier cosa que cifre.
 */
const global_ = globalThis as { crypto?: Partial<Crypto> };

if (!global_.crypto) global_.crypto = {};

if (typeof global_.crypto.getRandomValues !== 'function') {
  global_.crypto.getRandomValues = Crypto.getRandomValues as Crypto['getRandomValues'];
}
