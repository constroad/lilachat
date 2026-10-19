import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { OutboxItem, SendOutcome } from '@lilachat/shared';
import { BaseLocal } from './baseLocal';
import { drenarCola, encolarEnvio, reintentarEnvio, descartarEnvio } from './colaDeEnvio';
import { mensajesDelChat } from './mensajesLocales';

let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`cola-${(numero += 1)}`));

afterEach(async () => {
  base.close();
  await base.delete();
});

const envio = (clientKey: string, queuedAt = '2026-10-19T15:00:00.000Z'): OutboxItem => ({
  clientKey,
  chatId: 'c1',
  kind: 'text',
  body: `texto ${clientKey}`,
  queuedAt,
  attempts: 0,
});

/** Un «server» que contesta lo que se le diga, en orden. */
function server(respuestas: SendOutcome[]) {
  const recibidos: string[] = [];
  return {
    recibidos,
    enviar: async (item: OutboxItem): Promise<SendOutcome> => {
      recibidos.push(item.clientKey);
      return respuestas.shift() ?? { status: 'unreachable' };
    },
  };
}

describe('encolarEnvio', () => {
  it('tocar enviar dos veces con la misma clave no lo encola dos veces', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a'));
    await encolarEnvio(base, envio('a'));

    expect(await base.cola.count()).toBe(1);
  });
});

describe('drenarCola', () => {
  it('manda en orden y, confirmado, pasa a los mensajes con el seq del server', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a', '2026-10-19T15:00:01.000Z'));
    await encolarEnvio(base, envio('b', '2026-10-19T15:00:02.000Z'));
    const { recibidos, enviar } = server([{ status: 'sent', seq: 10 }, { status: 'sent', seq: 11 }]);

    await drenarCola({ base, yo: 'u1', enviar });

    expect(recibidos).toEqual(['a', 'b']);
    expect(await base.cola.count()).toBe(0);
    const mensajes = await mensajesDelChat(base, 'c1', 10);
    expect(mensajes.map((m) => [m.seq, m.clientKey, m.senderId])).toEqual([
      [10, 'a', 'u1'],
      [11, 'b', 'u1'],
    ]);
  });

  it('el duplicado del server es ÉXITO', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a'));

    await drenarCola({ base, yo: 'u1', enviar: server([{ status: 'duplicate', seq: 7 }]).enviar });

    expect(await base.cola.count()).toBe(0);
  });

  it('sin red se detiene, suma el intento y dice cuándo reintentar', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a'));
    await encolarEnvio(base, envio('b'));
    const { recibidos, enviar } = server([{ status: 'unreachable' }]);

    const resultado = await drenarCola({ base, yo: 'u1', enviar });

    expect(recibidos).toEqual(['a']);
    expect(resultado.reintentarEn).toBe(1_000);
    expect((await base.cola.get('a'))?.attempts).toBe(1);
  });

  it('un rechazo permanente queda fallido con su motivo y NO traba a los de atrás', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a', '2026-10-19T15:00:01.000Z'));
    await encolarEnvio(base, envio('b', '2026-10-19T15:00:02.000Z'));
    const { recibidos, enviar } = server([
      { status: 'rejected', httpStatus: 403, message: 'Ya no eres miembro' },
      { status: 'sent', seq: 3 },
    ]);

    await drenarCola({ base, yo: 'u1', enviar });

    expect(recibidos).toEqual(['a', 'b']);
    expect((await base.cola.get('a'))?.fallo).toBe('Ya no eres miembro');
  });

  it('401 marca todo como fallido y no borra nada', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a'));
    await encolarEnvio(base, envio('b'));

    await drenarCola({ base, yo: 'u1', enviar: server([{ status: 'unauthorized' }]).enviar });

    const cola = await base.cola.toArray();
    expect(cola).toHaveLength(2);
    expect(cola.every((item) => item.fallo)).toBe(true);
  });

  it('dos drenados a la vez no mandan dos veces lo mismo', async () => {
    nuevaBase();
    await encolarEnvio(base, envio('a'));
    const { recibidos, enviar } = server([{ status: 'sent', seq: 1 }, { status: 'sent', seq: 2 }]);

    await Promise.all([drenarCola({ base, yo: 'u1', enviar }), drenarCola({ base, yo: 'u1', enviar })]);

    expect(recibidos).toEqual(['a']);
  });
});

describe('reintentar y descartar un fallido', () => {
  it('reintentar le quita la marca y pone los intentos en cero', async () => {
    nuevaBase();
    await base.cola.put({ ...envio('a'), attempts: 3, fallo: 'No' });

    await reintentarEnvio(base, 'a');

    const item = await base.cola.get('a');
    expect(item?.fallo).toBeUndefined();
    expect(item?.attempts).toBe(0);
  });

  it('descartar lo saca para siempre', async () => {
    nuevaBase();
    await base.cola.put({ ...envio('a'), fallo: 'No' });

    await descartarEnvio(base, 'a');

    expect(await base.cola.count()).toBe(0);
  });
});
