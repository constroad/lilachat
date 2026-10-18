import { describe, expect, it } from 'vitest';
import { unSoloPedido } from './pedidoUnico';

/**
 * FL4: la lista de chats se pedía 6 veces al arrancar (la lista y las pestañas
 * pedían cada una, y otra vez al conectar). Dos pedidos IGUALES en vuelo se
 * juntan en uno; terminado, el siguiente vuelve a ir al server (no es caché).
 */
describe('unSoloPedido', () => {
  it('dos pedidos iguales en vuelo: una sola ida al server, el mismo resultado', async () => {
    let idas = 0;
    const hacer = async () => {
      idas += 1;
      await new Promise((resolver) => setTimeout(resolver, 10));
      return 'lista';
    };

    const [a, b] = await Promise.all([unSoloPedido('chats:tok', hacer), unSoloPedido('chats:tok', hacer)]);

    expect([a, b]).toEqual(['lista', 'lista']);
    expect(idas).toBe(1);
  });

  it('terminado el primero, el siguiente vuelve a ir (no guarda nada)', async () => {
    let idas = 0;
    const hacer = async () => ++idas;

    await unSoloPedido('chats:otro', hacer);
    await unSoloPedido('chats:otro', hacer);

    expect(idas).toBe(2);
  });

  it('claves distintas no se juntan', async () => {
    let idas = 0;
    const hacer = async () => ++idas;

    await Promise.all([unSoloPedido('a', hacer), unSoloPedido('b', hacer)]);

    expect(idas).toBe(2);
  });

  it('si falla, falla para los dos y el próximo vuelve a intentar', async () => {
    let idas = 0;
    const falla = async () => {
      idas += 1;
      throw new Error('sin red');
    };

    await expect(Promise.all([unSoloPedido('x', falla), unSoloPedido('x', falla)])).rejects.toThrow('sin red');
    await expect(unSoloPedido('x', falla)).rejects.toThrow('sin red');
    expect(idas).toBe(2);
  });
});
