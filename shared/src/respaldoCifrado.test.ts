import { describe, expect, it } from 'vitest';
import {
  abrirRespaldo,
  armarRespaldo,
  claveDeRespaldo,
  passphraseValida,
  KDF_DE_PRUEBA,
  type ContenidoDeRespaldo,
} from './respaldoCifrado.js';

/**
 * El respaldo de las conversaciones, cifrado en el TELÉFONO con una passphrase
 * que el server nunca ve (F12.1). Es lo que hace real «como WhatsApp» en el
 * sentido que José eligió: privacidad. Con el cifrado por defecto (F12.3) el
 * `mongodump` del server deja de ser legible, así que la única copia legible
 * sale de acá — y solo la abre quien sabe la passphrase.
 *
 * Los tests corren con un scrypt chico (`KDF_DE_PRUEBA`): el de verdad tarda
 * segundos a propósito, que es lo que frena a quien intente adivinarla.
 */
const contenido: ContenidoDeRespaldo = {
  v: 1,
  creadoEn: '2026-09-15T22:00:00.000Z',
  telefono: '51902049935',
  chats: [
    { chatId: '68a1', mensajes: [{ seq: 1, body: 'hola familia' }, { seq: 2, body: '¿vienen el domingo? 🎉' }] },
    { chatId: '68b2', mensajes: [] },
  ],
};

describe('claveDeRespaldo', () => {
  it('la misma passphrase y la misma sal dan la misma clave (si no, no habría restore)', () => {
    const sal = new Uint8Array(16).fill(3);

    const una = claveDeRespaldo('la clave es 4821', sal, KDF_DE_PRUEBA);
    const otra = claveDeRespaldo('la clave es 4821', sal, KDF_DE_PRUEBA);

    expect(una).toEqual(otra);
    expect(una).toHaveLength(32);
  });

  it('otra sal da otra clave: dos respaldos con la misma passphrase no comparten clave', () => {
    const una = claveDeRespaldo('la clave es 4821', new Uint8Array(16).fill(3), KDF_DE_PRUEBA);
    const otra = claveDeRespaldo('la clave es 4821', new Uint8Array(16).fill(4), KDF_DE_PRUEBA);

    expect(una).not.toEqual(otra);
  });
});

describe('armarRespaldo / abrirRespaldo', () => {
  it('lo que se cierra con una passphrase se abre con la misma', () => {
    const respaldo = armarRespaldo('la clave es 4821', contenido, KDF_DE_PRUEBA);

    expect(abrirRespaldo('la clave es 4821', respaldo, KDF_DE_PRUEBA)).toEqual(contenido);
  });

  /** El respaldo lleva su sal y sus parámetros: para restaurar alcanza con la passphrase. */
  it('el respaldo es autocontenido: sal y parámetros viajan adentro, la passphrase no', () => {
    const respaldo = armarRespaldo('la clave es 4821', contenido, KDF_DE_PRUEBA);

    expect(respaldo.kdf.sal).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(respaldo.kdf).toMatchObject({ n: KDF_DE_PRUEBA.n, r: KDF_DE_PRUEBA.r, p: KDF_DE_PRUEBA.p });
    expect(JSON.stringify(respaldo)).not.toContain('la clave es 4821');
  });

  it('en el archivo no queda ni el texto ni los ids de los chats', () => {
    const respaldo = armarRespaldo('la clave es 4821', contenido, KDF_DE_PRUEBA);
    const serializado = JSON.stringify(respaldo);

    expect(serializado).not.toContain('hola familia');
    expect(serializado).not.toContain('68a1');
    expect(serializado).not.toContain('51902049935');
  });

  /** Con otra passphrase NO se abre. Es lo que hace que el cifrado sirva de algo. */
  it('con otra passphrase devuelve null, no un contenido vacío', () => {
    const respaldo = armarRespaldo('la clave es 4821', contenido, KDF_DE_PRUEBA);

    expect(abrirRespaldo('la clave es 4822', respaldo, KDF_DE_PRUEBA)).toBeNull();
  });

  it('un respaldo manipulado devuelve null', () => {
    const respaldo = armarRespaldo('la clave es 4821', contenido, KDF_DE_PRUEBA);
    // Always a DIFFERENT first character: with a fixed «A», one backup in 64 already started with it and stayed untouched (flaky, 21/10).
    const firstChar = respaldo.sobre.ciphertext[0] === 'A' ? 'B' : 'A';
    const tocado = { ...respaldo, sobre: { ...respaldo.sobre, ciphertext: `${firstChar}${respaldo.sobre.ciphertext.slice(1)}` } };

    expect(abrirRespaldo('la clave es 4821', tocado, KDF_DE_PRUEBA)).toBeNull();
  });

  /** Un archivo de otra versión o con otra forma no revienta la app: se dice que no se pudo. */
  it('basura o una versión desconocida devuelven null en vez de romper', () => {
    expect(abrirRespaldo('x', null, KDF_DE_PRUEBA)).toBeNull();
    expect(abrirRespaldo('x', { v: 99 }, KDF_DE_PRUEBA)).toBeNull();
    expect(abrirRespaldo('x', { v: 1, kdf: { n: 1, r: 1, p: 1, sal: '??' }, sobre: { v: 1, nonce: '', ciphertext: '' } }, KDF_DE_PRUEBA)).toBeNull();
  });

  /** Que descifre bien no alcanza: lo descifrado tiene que SER un respaldo. */
  it('un contenido descifrado que no tiene forma de respaldo devuelve null', () => {
    const respaldo = armarRespaldo('la clave es 4821', { otra: 'cosa' } as unknown as ContenidoDeRespaldo, KDF_DE_PRUEBA);

    expect(abrirRespaldo('la clave es 4821', respaldo, KDF_DE_PRUEBA)).toBeNull();
  });

  /** Un espacio que se escapó al tipear no puede dejar a alguien sin su historial. */
  it('los espacios de los bordes de la passphrase no cuentan al abrir', () => {
    const respaldo = armarRespaldo('la clave es 4821', contenido, KDF_DE_PRUEBA);

    expect(abrirRespaldo('  la clave es 4821 ', respaldo, KDF_DE_PRUEBA)).toEqual(contenido);
  });

  it('sobrevive a tildes, emojis y chats vacíos', () => {
    const respaldo = armarRespaldo('contraseña con ñ y 🎉', contenido, KDF_DE_PRUEBA);

    expect(abrirRespaldo('contraseña con ñ y 🎉', respaldo, KDF_DE_PRUEBA)?.chats[1]).toEqual({ chatId: '68b2', mensajes: [] });
  });
});

describe('passphraseValida', () => {
  it('acepta ocho caracteres o más, con espacios adentro', () => {
    expect(passphraseValida('la clave es 4821')).toBe(true);
    expect(passphraseValida('12345678')).toBe(true);
  });

  it('rechaza las cortas y las que son solo espacios', () => {
    expect(passphraseValida('1234567')).toBe(false);
    expect(passphraseValida('        ')).toBe(false);
    expect(passphraseValida('')).toBe(false);
  });

  /** Los espacios de los bordes no cuentan: «  clave  » y «clave» tienen que abrir el mismo respaldo. */
  it('no cuenta los espacios de los bordes', () => {
    expect(passphraseValida('   1234567   ')).toBe(false);
  });
});
