import { describe, expect, it } from 'vitest';
import {
  advanceChain,
  base64ToBytes,
  bytesToBase64,
  decryptMessage,
  deriveSessionRoot,
  encryptMessage,
  generateIdentity,
  publicKeyFingerprint,
} from './e2ee.js';

/**
 * El cifrado extremo a extremo de los chats secretos (F9).
 *
 * Lo que se prueba acá no es «la criptografía funciona» —eso lo garantizan las
 * curvas auditadas que usamos— sino **que la usamos bien**: que las dos partes
 * llegan al mismo secreto, que cada mensaje usa una clave distinta, que un
 * mensaje alterado se RECHAZA en vez de descifrarse a basura, y que el texto
 * plano no queda por ningún lado del sobre.
 */
const dosPartes = () => {
  const ana = generateIdentity();
  const beto = generateIdentity();
  return {
    ana,
    beto,
    raizAna: deriveSessionRoot({ myPrivateKey: ana.privateKey, theirPublicKey: beto.publicKey }),
    raizBeto: deriveSessionRoot({ myPrivateKey: beto.privateKey, theirPublicKey: ana.publicKey }),
  };
};

describe('deriveSessionRoot', () => {
  /** Las dos partes llegan al MISMO secreto sin que viaje por ningún lado. */
  it('ambos lados derivan la misma raíz', () => {
    const { raizAna, raizBeto } = dosPartes();

    expect(Buffer.from(raizAna).toString('hex')).toBe(Buffer.from(raizBeto).toString('hex'));
  });

  it('con otro interlocutor la raíz es distinta', () => {
    const { ana, raizAna } = dosPartes();
    const tercero = generateIdentity();

    const otra = deriveSessionRoot({
      myPrivateKey: ana.privateKey,
      theirPublicKey: tercero.publicKey,
    });

    expect(Buffer.from(otra).toString('hex')).not.toBe(Buffer.from(raizAna).toString('hex'));
  });
});

describe('advanceChain', () => {
  /**
   * Cada mensaje usa una clave PROPIA, derivada de la anterior y sin vuelta
   * atrás. Es lo que hace que robar el teléfono hoy no abra lo de ayer: la
   * clave del mensaje 5 no permite reconstruir la del 4.
   */
  it('cada paso da una clave distinta', () => {
    const { raizAna } = dosPartes();

    const uno = advanceChain(raizAna);
    const dos = advanceChain(uno.nextChain);

    expect(Buffer.from(uno.messageKey).toString('hex')).not.toBe(
      Buffer.from(dos.messageKey).toString('hex')
    );
  });

  it('la cadena avanza igual en los dos lados', () => {
    const { raizAna, raizBeto } = dosPartes();

    expect(Buffer.from(advanceChain(raizAna).messageKey).toString('hex')).toBe(
      Buffer.from(advanceChain(raizBeto).messageKey).toString('hex')
    );
  });

  /** La cadena nueva no puede ser la vieja: sin avance no hay ratchet. */
  it('la cadena cambia en cada paso', () => {
    const { raizAna } = dosPartes();
    const paso = advanceChain(raizAna);

    expect(Buffer.from(paso.nextChain).toString('hex')).not.toBe(
      Buffer.from(raizAna).toString('hex')
    );
  });
});

describe('encryptMessage / decryptMessage', () => {
  it('lo que cifra uno lo abre el otro', () => {
    const { raizAna, raizBeto } = dosPartes();

    const sobre = encryptMessage(advanceChain(raizAna).messageKey, 'nos vemos el domingo');
    const texto = decryptMessage(advanceChain(raizBeto).messageKey, sobre);

    expect(texto).toBe('nos vemos el domingo');
  });

  /**
   * El sobre que viaja NO contiene el texto por ningún lado. Es la prueba que
   * de verdad importa: si el plano se colara en un campo del sobre, todo lo
   * demás daría igual.
   */
  it('el sobre no lleva el texto plano', () => {
    const { raizAna } = dosPartes();

    const sobre = encryptMessage(advanceChain(raizAna).messageKey, 'arroz con pato');

    expect(JSON.stringify(sobre)).not.toContain('arroz');
    expect(JSON.stringify(sobre)).not.toContain('pato');
  });

  /**
   * Un mensaje alterado se RECHAZA, no se descifra a basura. AES-GCM autentica:
   * sin esto, alguien con acceso a la base podría cambiar el contenido y el
   * teléfono mostraría lo que le manden.
   */
  it('un sobre manipulado no se abre', () => {
    const { raizAna, raizBeto } = dosPartes();
    const sobre = encryptMessage(advanceChain(raizAna).messageKey, 'hola');

    const alterado = { ...sobre, ciphertext: sobre.ciphertext.replace(/.$/, 'A') };

    expect(() => decryptMessage(advanceChain(raizBeto).messageKey, alterado)).toThrow();
  });

  /** Con la clave equivocada tampoco: no hay descifrado parcial. */
  it('con otra clave no se abre', () => {
    const { raizAna } = dosPartes();
    const otros = dosPartes();
    const sobre = encryptMessage(advanceChain(raizAna).messageKey, 'hola');

    expect(() => decryptMessage(advanceChain(otros.raizAna).messageKey, sobre)).toThrow();
  });

  /**
   * Dos veces el mismo texto con la misma clave produce sobres DISTINTOS: el
   * nonce es aleatorio. Si fueran iguales, un observador vería cuándo se repite
   * un mensaje sin poder leerlo.
   */
  it('el mismo texto dos veces da sobres distintos', () => {
    const { raizAna } = dosPartes();
    const clave = advanceChain(raizAna).messageKey;

    const uno = encryptMessage(clave, 'ok');
    const dos = encryptMessage(clave, 'ok');

    expect(uno.ciphertext).not.toBe(dos.ciphertext);
    expect(uno.nonce).not.toBe(dos.nonce);
  });

  it('sobrevive a acentos, emojis y saltos de línea', () => {
    const { raizAna, raizBeto } = dosPartes();
    const original = 'Mañana 8pm ❤️\nCasa de la abuela';

    const sobre = encryptMessage(advanceChain(raizAna).messageKey, original);

    expect(decryptMessage(advanceChain(raizBeto).messageKey, sobre)).toBe(original);
  });
});

describe('publicKeyFingerprint', () => {
  /**
   * La huella que las dos personas comparan para saber que hablan entre ellas
   * y no con alguien en el medio. Se muestra igual en los dos teléfonos, así
   * que tiene que ser la MISMA sin importar quién la calcule.
   */
  it('es igual mirada desde cualquiera de los dos lados', () => {
    const { ana, beto } = dosPartes();

    expect(publicKeyFingerprint(ana.publicKey, beto.publicKey)).toBe(
      publicKeyFingerprint(beto.publicKey, ana.publicKey)
    );
  });

  it('cambia si cambia una de las claves', () => {
    const { ana, beto } = dosPartes();
    const otro = generateIdentity();

    expect(publicKeyFingerprint(ana.publicKey, beto.publicKey)).not.toBe(
      publicKeyFingerprint(ana.publicKey, otro.publicKey)
    );
  });

  /** Se lee en voz alta por teléfono: grupos cortos, no un chorro de hex. */
  it('viene en grupos legibles', () => {
    const { ana, beto } = dosPartes();

    expect(publicKeyFingerprint(ana.publicKey, beto.publicKey)).toMatch(
      /^(\d{5} ){5}\d{5}$/
    );
  });
});

describe('base64 portable', () => {
  /**
   * Este módulo corre en Node, en el navegador y en Hermes, y `Buffer` solo
   * existe en el primero. El base64 propio es lo que evita un polyfill por
   * plataforma — y si tuviera un borde mal resuelto, los sobres se corromperían
   * solo en el teléfono, que es donde más caro sale descubrirlo.
   */
  it('ida y vuelta con longitudes que caen en cada relleno', () => {
    for (const largo of [0, 1, 2, 3, 4, 5, 31, 32, 33]) {
      const bytes = new Uint8Array(largo).map((_, index) => (index * 37) % 256);
      const vuelta = base64ToBytes(bytesToBase64(bytes));

      expect(Array.from(vuelta)).toEqual(Array.from(bytes));
    }
  });

  it('coincide con el base64 de Node', () => {
    const bytes = new Uint8Array([0, 1, 250, 255, 128, 64]);

    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('un base64 con basura se rechaza, no devuelve bytes inventados', () => {
    expect(() => base64ToBytes('no-es-base64-válido!!')).toThrow();
  });
});
