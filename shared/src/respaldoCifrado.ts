import { scrypt } from '@noble/hashes/scrypt.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBase64, decryptMessage, encryptMessage, type Envelope } from './e2ee.js';

/**
 * El respaldo de las conversaciones, cifrado en el TELÉFONO con una passphrase
 * que el server nunca ve (F12.1). PURO: corre igual en Hermes, en el navegador
 * y en Node (para el simulacro de restauración de la copia dominical).
 *
 * Por qué así y no el `mongodump` de F7: con el cifrado por defecto (F12.3) el
 * server deja de poder leer los chats, así que la única copia legible tiene que
 * salir del teléfono — y solo la puede abrir quien sabe la passphrase. Es el
 * respaldo cifrado de extremo a extremo de WhatsApp, con el archivo en la mini
 * en vez de en Google Drive.
 *
 * Dos decisiones:
 * - **scrypt** para pasar de passphrase a clave. Es caro en memoria a propósito:
 *   quien intente adivinarla paga segundos por intento, en JS puro y también
 *   con hardware. Los parámetros viajan en el archivo, así el día que se suban
 *   los respaldos viejos siguen abriendo.
 * - **El MISMO AES-GCM de F9** (`encryptMessage`): un segundo mecanismo de
 *   cifrado es un segundo lugar donde equivocarse.
 *
 * **Passphrase perdida = respaldo irrecuperable.** No hay puerta de atrás, y la
 * interfaz lo tiene que decir sin letra chica.
 */

export type ParametrosKdf = { n: number; r: number; p: number };

/**
 * scrypt N=2^14, r=8, p=1: 16 MB de memoria y del orden de un segundo en un
 * teléfono con Hermes. Es una vez por respaldo y una vez por restauración; para
 * quien adivina, un segundo por intento es el punto.
 */
export const KDF_POR_DEFECTO: ParametrosKdf = { n: 2 ** 14, r: 8, p: 1 };

/** Para los tests: mismo algoritmo, sin esperar. NUNCA para un respaldo real. */
export const KDF_DE_PRUEBA: ParametrosKdf = { n: 2 ** 8, r: 8, p: 1 };

const BYTES_DE_SAL = 16;
const BYTES_DE_CLAVE = 32;
const PASSPHRASE_MINIMA = 8;
const VERSION = 1;

/** Lo que se respalda: la copia del almacén del teléfono, chat por chat. */
export type ContenidoDeRespaldo = {
  v: 1;
  creadoEn: string;
  telefono: string;
  chats: { chatId: string; mensajes: unknown[] }[];
};

/** El archivo: autocontenido. Con la passphrase alcanza para restaurar. */
export type RespaldoCifrado = {
  v: 1;
  kdf: ParametrosKdf & { sal: string };
  sobre: Envelope;
};

/** Ocho o más, sin contar los espacios de los bordes. */
export function passphraseValida(passphrase: string): boolean {
  return passphrase.trim().length >= PASSPHRASE_MINIMA;
}

export function claveDeRespaldo(passphrase: string, sal: Uint8Array, kdf: ParametrosKdf): Uint8Array {
  return scrypt(new TextEncoder().encode(passphrase.trim()), sal, {
    N: kdf.n,
    r: kdf.r,
    p: kdf.p,
    dkLen: BYTES_DE_CLAVE,
  });
}

export function armarRespaldo(
  passphrase: string,
  contenido: ContenidoDeRespaldo,
  kdf: ParametrosKdf = KDF_POR_DEFECTO
): RespaldoCifrado {
  const sal = randomBytes(BYTES_DE_SAL);
  const clave = claveDeRespaldo(passphrase, sal, kdf);
  return {
    v: VERSION,
    kdf: { ...kdf, sal: bytesToBase64(sal) },
    sobre: encryptMessage(clave, JSON.stringify(contenido)),
  };
}

/**
 * Devuelve `null` ante CUALQUIER problema —otra passphrase, archivo tocado,
 * versión desconocida, un JSON que no es un respaldo—. Quien restaura tiene
 * que poder decir «no se pudo» sin que la app reviente.
 *
 * `kdfMaximo` acota los parámetros que se aceptan del archivo: un respaldo
 * manipulado con `n` gigante colgaría el teléfono al intentar abrirlo.
 */
export function abrirRespaldo(
  passphrase: string,
  respaldo: unknown,
  kdfMaximo: ParametrosKdf = KDF_POR_DEFECTO
): ContenidoDeRespaldo | null {
  if (!esRespaldoCifrado(respaldo) || !kdfAceptable(respaldo.kdf, kdfMaximo)) return null;
  try {
    const clave = claveDeRespaldo(passphrase, base64ToBytes(respaldo.kdf.sal), respaldo.kdf);
    const contenido: unknown = JSON.parse(decryptMessage(clave, respaldo.sobre));
    return esContenidoDeRespaldo(contenido) ? contenido : null;
  } catch {
    return null;
  }
}

function esRespaldoCifrado(valor: unknown): valor is RespaldoCifrado {
  if (!valor || typeof valor !== 'object') return false;
  const candidato = valor as Partial<RespaldoCifrado>;
  return (
    candidato.v === VERSION &&
    typeof candidato.kdf?.sal === 'string' &&
    typeof candidato.kdf.n === 'number' &&
    typeof candidato.kdf.r === 'number' &&
    typeof candidato.kdf.p === 'number' &&
    typeof candidato.sobre?.nonce === 'string' &&
    typeof candidato.sobre.ciphertext === 'string'
  );
}

function kdfAceptable(kdf: ParametrosKdf, maximo: ParametrosKdf): boolean {
  return kdf.n > 1 && kdf.n <= maximo.n && kdf.r >= 1 && kdf.r <= maximo.r && kdf.p >= 1 && kdf.p <= maximo.p;
}

function esContenidoDeRespaldo(valor: unknown): valor is ContenidoDeRespaldo {
  if (!valor || typeof valor !== 'object') return false;
  const candidato = valor as Partial<ContenidoDeRespaldo>;
  return (
    candidato.v === VERSION &&
    typeof candidato.creadoEn === 'string' &&
    typeof candidato.telefono === 'string' &&
    Array.isArray(candidato.chats) &&
    candidato.chats.every((chat) => typeof chat?.chatId === 'string' && Array.isArray(chat.mensajes))
  );
}
