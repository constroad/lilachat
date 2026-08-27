import { describe, expect, it } from 'vitest';
import { abrirCache, cerrarCache, recortarParaCache, MAX_MENSAJES_EN_CACHE } from './cacheCifrada.js';

/**
 * Los mensajes guardados en el teléfono, CIFRADOS en reposo.
 *
 * José, 26/08/2026: «sigue con los mensajes, cifrados en reposo». La app es
 * local-first desde acá: abrir un chat pinta lo guardado al instante en vez de
 * esperar al socket.
 *
 * Guardar cuerpos de mensajes en claro sería regalar el historial de la familia
 * a cualquier app con permiso de archivos, y contradiría de frente a los chats
 * secretos — que existen para que ni el server los lea.
 */
const clave = new Uint8Array(32).fill(7);

describe('cerrarCache / abrirCache', () => {
  it('lo que se guarda se recupera igual', () => {
    const mensajes = [{ seq: 1, body: 'hola' }, { seq: 2, body: 'chau' }];

    expect(abrirCache(clave, cerrarCache(clave, mensajes))).toEqual(mensajes);
  });

  it('sobrevive a tildes y emojis', () => {
    const mensajes = [{ seq: 1, body: '¿Vienes el domingo? 🎉 — Mamá' }];

    expect(abrirCache(clave, cerrarCache(clave, mensajes))).toEqual(mensajes);
  });

  /** Lo guardado NO puede parecerse al texto original. */
  it('en disco no queda el texto', () => {
    const guardado = cerrarCache(clave, [{ seq: 1, body: 'secreto-de-familia' }]);

    expect(JSON.stringify(guardado)).not.toContain('secreto-de-familia');
  });

  /**
   * **Con otra clave NO se abre.** Es lo que hace que el cifrado sirva de algo:
   * si se abriera igual, guardar cifrado sería decoración.
   */
  it('con otra clave no se abre', () => {
    const guardado = cerrarCache(clave, [{ seq: 1, body: 'hola' }]);
    const otra = new Uint8Array(32).fill(9);

    expect(abrirCache(otra, guardado)).toBeNull();
  });

  /**
   * Un archivo corrupto o de una versión vieja devuelve `null`, no revienta: la
   * caché es una comodidad, y perderla solo cuesta esperar a la red una vez.
   */
  it('basura devuelve null en vez de romper', () => {
    expect(abrirCache(clave, { v: 1, nonce: 'no-es-base64', ciphertext: '??' })).toBeNull();
    expect(abrirCache(clave, null)).toBeNull();
  });
});

describe('recortarParaCache', () => {
  it('guarda los ÚLTIMOS, que son los que se ven al abrir', () => {
    const muchos = Array.from({ length: MAX_MENSAJES_EN_CACHE + 20 }, (_, i) => ({
      seq: i,
      body: String(i),
    }));

    const recortado = recortarParaCache(muchos);

    expect(recortado).toHaveLength(MAX_MENSAJES_EN_CACHE);
    // El último mensaje del chat tiene que estar: es el que se lee primero.
    expect(recortado.at(-1)?.seq).toBe(muchos.at(-1)?.seq);
  });

  it('si son pocos, van todos', () => {
    expect(recortarParaCache([{ seq: 1, body: 'a' }])).toHaveLength(1);
  });
});
