import { describe, expect, it } from 'vitest';
import { conciliarCache, MAX_CHATS_EN_CACHE } from './cacheDeChats';

/**
 * Abrir la app y VER algo, en vez de esqueletos.
 *
 * José, 26/08/2026: «¿revisaste la estrategia que usa WhatsApp para que la app
 * sea fluida?». La diferencia de fondo no es el render —eso ya se virtualizó—
 * sino que **Lilachat no guardaba nada**: cada apertura empezaba en blanco y
 * esperaba a la red. WhatsApp es local-first: pinta desde el teléfono al
 * instante y concilia con el server por detrás.
 *
 * Este motor decide qué se ve mientras tanto.
 */
const chat = (id: string, unread = 0) => ({
  id,
  name: id,
  kind: 'direct' as const,
  unread,
  memberIds: [],
  lastSeq: 0,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
});

describe('conciliarCache', () => {
  it('sin respuesta del server todavía, se ve lo guardado', () => {
    expect(conciliarCache({ guardado: [chat('a')], delServer: null })).toEqual([chat('a')]);
  });

  /**
   * Cuando llega el server, MANDA él —incluso para borrar—. Si se fusionara,
   * un chat eliminado en otro teléfono no desaparecería nunca de este.
   */
  it('cuando llega el server, manda el server', () => {
    expect(conciliarCache({ guardado: [chat('a'), chat('b')], delServer: [chat('a')] })).toEqual([
      chat('a'),
    ]);
  });

  it('sin nada guardado y sin server, no se inventa nada', () => {
    expect(conciliarCache({ guardado: null, delServer: null })).toBeNull();
  });

  /**
   * El server vacío es un RESULTADO, no «todavía no llegó»: hay que poder
   * quedarse sin conversaciones.
   */
  it('el server sin chats vacía la lista', () => {
    expect(conciliarCache({ guardado: [chat('a')], delServer: [] })).toEqual([]);
  });

  /**
   * La caché se acota: guardar mil conversaciones para pintar las diez que
   * entran en pantalla es leer un archivo grande en cada arranque, que es
   * justo lo que se quiere evitar.
   */
  it('se guarda un tope de conversaciones', () => {
    const muchos = Array.from({ length: MAX_CHATS_EN_CACHE + 30 }, (_, i) => chat(`c${i}`));

    expect(conciliarCache({ guardado: null, delServer: muchos })).toHaveLength(
      MAX_CHATS_EN_CACHE
    );
  });
});
