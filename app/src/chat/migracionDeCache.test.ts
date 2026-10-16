import { describe, expect, it } from 'vitest';
import { chatIdsAMigrar, PREFIJO_CACHE_VIEJA } from './migracionDeCache';

/**
 * Del blob por chat en AsyncStorage al almacén SQLite (F12.0), una sola vez.
 *
 * La caché vieja guardaba `lilachat.msgs.<chatId>` con los últimos 60 mensajes
 * cifrados. Lo que fija este test es QUÉ claves se migran: solo las de
 * mensajes, con su `chatId` limpio — la lista de chats, la cola de salida y
 * cualquier otra clave del mismo AsyncStorage no son de este módulo.
 */
describe('chatIdsAMigrar', () => {
  it('saca el chatId de cada clave de mensajes', () => {
    const claves = [`${PREFIJO_CACHE_VIEJA}68a1`, `${PREFIJO_CACHE_VIEJA}68b2`];

    expect(chatIdsAMigrar(claves)).toEqual(['68a1', '68b2']);
  });

  it('ignora las claves que no son de mensajes', () => {
    const claves = ['lilachat.chats', 'lilachat.outbox', `${PREFIJO_CACHE_VIEJA}68a1`, 'otraApp.msgs.x'];

    expect(chatIdsAMigrar(claves)).toEqual(['68a1']);
  });

  /** El prefijo sin punto final NO alcanza: «lilachat.msgs» a secas no es un chat. */
  it('una clave que es solo el prefijo, sin chatId, no se migra', () => {
    expect(chatIdsAMigrar([PREFIJO_CACHE_VIEJA, PREFIJO_CACHE_VIEJA.slice(0, -1)])).toEqual([]);
  });

  it('sin claves, sin migración', () => {
    expect(chatIdsAMigrar([])).toEqual([]);
  });
});
