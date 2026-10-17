import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBase64, decryptMessage, encryptMessage, type Envelope } from './e2ee.js';
import {
  abrirConClave,
  esRespaldoCifrado,
  kdfAceptable,
  KDF_POR_DEFECTO,
  type ContenidoDeRespaldo,
  type ParametrosKdf,
} from './respaldoCifrado.js';

/**
 * El respaldo v2: el MISMO cifrado de `respaldoCifrado` (scrypt + AES-GCM),
 * pero en trozos y cediendo el hilo entre uno y otro (FL5, spec §45).
 *
 * El v1 era un solo sobre: con 20 000 mensajes, `JSON.stringify` + AES-GCM de
 * varios MB corrían de un tirón en el hilo de JS y la pantalla quedaba
 * congelada —hasta el ANR en un gama baja—. Acá cada trozo es chico y entre
 * trozo y trozo la pantalla puede dibujar; scrypt va con `scryptAsync`, que
 * también suelta el hilo cada pocos ms.
 *
 * Partir en sobres abre un hueco que el sobre único no tenía: cada trozo
 * autentica su contenido pero no su LUGAR. Por eso el id del respaldo y el
 * índice viajan ADENTRO de cada trozo, y la cabecera cifrada dice cuántos son:
 * reordenar, quitar, duplicar o mezclar trozos de otro respaldo no abre.
 */
export type RespaldoPorTrozos = {
  v: 2;
  kdf: ParametrosKdf & { sal: string };
  cabecera: Envelope;
  trozos: Envelope[];
};

/** Suelta el hilo un momento para que la pantalla dibuje. */
export type Ceder = () => Promise<void>;

/** Un `setTimeout(0)` deja pasar al menos un frame pendiente. */
export const cederAlHilo: Ceder = () => new Promise((listo) => setTimeout(listo, 0));

/** ~30 KB de JSON por trozo: ~10 ms en V8, decenas en Hermes (medido con 20 000 mensajes, FL5). */
export const MENSAJES_POR_TROZO = 100;

const VERSION = 2;
const BYTES_DE_SAL = 16;
const BYTES_DE_ID = 8;
const BYTES_DE_CLAVE = 32;

type Cabecera = { id: string; creadoEn: string; telefono: string; chats: string[]; trozos: number };
type Trozo = { id: string; i: number; chatId: string; mensajes: unknown[] };

export async function claveDeRespaldoAsync(passphrase: string, sal: Uint8Array, kdf: ParametrosKdf): Promise<Uint8Array> {
  return scryptAsync(new TextEncoder().encode(passphrase.trim()), sal, { N: kdf.n, r: kdf.r, p: kdf.p, dkLen: BYTES_DE_CLAVE });
}

export async function armarRespaldoPorTrozos(
  passphrase: string,
  contenido: ContenidoDeRespaldo,
  opciones: { kdf?: ParametrosKdf; mensajesPorTrozo?: number; ceder?: Ceder } = {}
): Promise<RespaldoPorTrozos> {
  const kdf = opciones.kdf ?? KDF_POR_DEFECTO;
  const ceder = opciones.ceder ?? cederAlHilo;
  const sal = randomBytes(BYTES_DE_SAL);
  const clave = await claveDeRespaldoAsync(passphrase, sal, kdf);
  const id = bytesToHex(randomBytes(BYTES_DE_ID));

  const trozos: Envelope[] = [];
  for (const partes of partirEnTrozos(contenido, opciones.mensajesPorTrozo ?? MENSAJES_POR_TROZO)) {
    const trozo: Trozo = { id, i: trozos.length, ...partes };
    trozos.push(encryptMessage(clave, JSON.stringify(trozo)));
    await ceder();
  }

  const cabecera: Cabecera = {
    id,
    creadoEn: contenido.creadoEn,
    telefono: contenido.telefono,
    chats: contenido.chats.map((chat) => chat.chatId),
    trozos: trozos.length,
  };
  return { v: VERSION, kdf: { ...kdf, sal: bytesToBase64(sal) }, cabecera: encryptMessage(clave, JSON.stringify(cabecera)), trozos };
}

function* partirEnTrozos(contenido: ContenidoDeRespaldo, tamano: number): Generator<{ chatId: string; mensajes: unknown[] }> {
  for (const chat of contenido.chats) {
    for (let desde = 0; desde < chat.mensajes.length; desde += tamano) {
      yield { chatId: chat.chatId, mensajes: chat.mensajes.slice(desde, desde + tamano) };
    }
  }
}

/**
 * Abre un v2 —y también un v1, los que ya están en la mini—. Como
 * `abrirRespaldo`: `null` ante CUALQUIER problema, nunca lanza.
 */
export async function abrirRespaldoAsync(
  passphrase: string,
  respaldo: unknown,
  opciones: { kdfMaximo?: ParametrosKdf; ceder?: Ceder } = {}
): Promise<ContenidoDeRespaldo | null> {
  const kdfMaximo = opciones.kdfMaximo ?? KDF_POR_DEFECTO;
  if (esRespaldoCifrado(respaldo)) {
    // El v1 es un solo sobre: no hay trozos entre los que ceder. Al menos el
    // scrypt, el paso más caro, no bloquea.
    if (!kdfAceptable(respaldo.kdf, kdfMaximo)) return null;
    try {
      return abrirConClave(await claveDeRespaldoAsync(passphrase, base64ToBytes(respaldo.kdf.sal), respaldo.kdf), respaldo);
    } catch {
      return null;
    }
  }
  if (!esRespaldoPorTrozos(respaldo) || !kdfAceptable(respaldo.kdf, kdfMaximo)) return null;
  try {
    const clave = await claveDeRespaldoAsync(passphrase, base64ToBytes(respaldo.kdf.sal), respaldo.kdf);
    return await reconstruir(clave, respaldo, opciones.ceder ?? cederAlHilo);
  } catch {
    return null;
  }
}

async function reconstruir(clave: Uint8Array, respaldo: RespaldoPorTrozos, ceder: Ceder): Promise<ContenidoDeRespaldo | null> {
  const cabecera: unknown = JSON.parse(decryptMessage(clave, respaldo.cabecera));
  if (!esCabecera(cabecera) || cabecera.trozos !== respaldo.trozos.length) return null;

  const porChat = new Map(cabecera.chats.map((chatId) => [chatId, [] as unknown[]]));
  for (const [indice, sobre] of respaldo.trozos.entries()) {
    const trozo: unknown = JSON.parse(decryptMessage(clave, sobre));
    if (!esTrozo(trozo) || trozo.id !== cabecera.id || trozo.i !== indice) return null;
    const mensajes = porChat.get(trozo.chatId);
    if (!mensajes) return null;
    mensajes.push(...trozo.mensajes);
    await ceder();
  }

  return {
    v: 1,
    creadoEn: cabecera.creadoEn,
    telefono: cabecera.telefono,
    chats: cabecera.chats.map((chatId) => ({ chatId, mensajes: porChat.get(chatId)! })),
  };
}

function esSobre(valor: unknown): valor is Envelope {
  const sobre = valor as Partial<Envelope> | null;
  return Boolean(sobre) && typeof sobre?.nonce === 'string' && typeof sobre.ciphertext === 'string';
}

function esRespaldoPorTrozos(valor: unknown): valor is RespaldoPorTrozos {
  if (!valor || typeof valor !== 'object') return false;
  const candidato = valor as Partial<RespaldoPorTrozos>;
  return (
    candidato.v === VERSION &&
    typeof candidato.kdf?.sal === 'string' &&
    typeof candidato.kdf.n === 'number' &&
    typeof candidato.kdf.r === 'number' &&
    typeof candidato.kdf.p === 'number' &&
    esSobre(candidato.cabecera) &&
    Array.isArray(candidato.trozos) &&
    candidato.trozos.every(esSobre)
  );
}

function esCabecera(valor: unknown): valor is Cabecera {
  const c = valor as Partial<Cabecera> | null;
  return (
    Boolean(c) &&
    typeof c?.id === 'string' &&
    typeof c.creadoEn === 'string' &&
    typeof c.telefono === 'string' &&
    Number.isInteger(c.trozos) &&
    Array.isArray(c.chats) &&
    c.chats.every((chatId) => typeof chatId === 'string')
  );
}

function esTrozo(valor: unknown): valor is Trozo {
  const t = valor as Partial<Trozo> | null;
  return Boolean(t) && typeof t?.id === 'string' && Number.isInteger(t.i) && typeof t.chatId === 'string' && Array.isArray(t.mensajes);
}
