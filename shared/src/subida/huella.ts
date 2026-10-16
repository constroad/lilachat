import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { Huella } from './tipos.js';

/**
 * La huella de un archivo: sha256 en hex minúscula (Lilafotos spec §6).
 *
 * Es el ÚNICO criterio de deduplicación, así que el teléfono y el server la
 * tienen que calcular igual. Por eso vive acá y no en cada lado: la misma
 * función corre en Hermes y en Node, y se fija contra vectores conocidos.
 *
 * `@noble/hashes` y no `crypto` de Node porque el teléfono no tiene Node.
 */

const FORMATO = /^[0-9a-f]{64}$/;

export function huellaDeBytes(bytes: Uint8Array): Huella {
  return bytesToHex(sha256(bytes));
}

/**
 * Para lo que no entra en memoria. Un video de 2 GB se lee por partes
 * (`File.readableStream()` en Expo); la huella de las partes es la del entero.
 */
export async function huellaDeTrozos(
  trozos: AsyncIterable<Uint8Array> | Iterable<Uint8Array>
): Promise<Huella> {
  const acumulador = sha256.create();
  for await (const trozo of trozos) {
    acumulador.update(trozo);
  }
  return bytesToHex(acumulador.digest());
}

/** Lo que llega por la red se valida antes de usarse como clave o como nombre. */
export function esHuella(valor: unknown): valor is Huella {
  return typeof valor === 'string' && FORMATO.test(valor);
}
