import { describe, expect, it } from 'vitest';
import { conPlazo, unaALaVez } from './plazo.js';

/**
 * Las dos defensas contra un disco USB que se cuelga. El 15/09/2026 el USB de
 * la mini se colgó a nivel kernel: `access`/`statfs` contestaban desde la caché
 * y `read`/`write` nunca. Cada fs op colgada ocupa un hilo del pool de Node
 * (son 4): al cuarto pedido murió el health y Torre reiniciaba en bucle.
 *
 * Por eso estas dos funciones NO son opcionales para nadie que escriba en ese
 * disco, y por eso nacen con test al copiarse a Lilachat.
 */
const nunca = <T>(): Promise<T> => new Promise<T>(() => undefined);
const enseguida = <T>(valor: T): Promise<T> => Promise.resolve(valor);

describe('conPlazo', () => {
  it('devuelve el valor si la promesa llega a tiempo', async () => {
    await expect(conPlazo(enseguida('montado'), 50, 'colgado')).resolves.toBe('montado');
  });

  it('devuelve el valor de vencimiento si la promesa no llega', async () => {
    await expect(conPlazo(nunca<string>(), 20, 'colgado')).resolves.toBe('colgado');
  });

  /** La promesa colgada sigue viva —Node no la cancela—; lo que se corta es la ESPERA. */
  it('no convierte un rechazo en vencimiento: el error se propaga', async () => {
    await expect(conPlazo(Promise.reject(new Error('disco roto')), 50, 'colgado')).rejects.toThrow('disco roto');
  });
});

describe('unaALaVez', () => {
  it('mientras una operación está en vuelo, las llamadas siguientes reciben la MISMA promesa', async () => {
    let lanzadas = 0;
    let soltar: (valor: number) => void = () => undefined;
    const operacion = unaALaVez(
      () =>
        new Promise<number>((resolver) => {
          lanzadas += 1;
          soltar = resolver;
        })
    );

    const primera = operacion();
    const segunda = operacion();
    soltar(42);

    expect(lanzadas).toBe(1);
    await expect(primera).resolves.toBe(42);
    await expect(segunda).resolves.toBe(42);
  });

  it('terminada la anterior, la próxima llamada lanza una nueva', async () => {
    let lanzadas = 0;
    const operacion = unaALaVez(async () => {
      lanzadas += 1;
      return lanzadas;
    });

    await operacion();
    await operacion();

    expect(lanzadas).toBe(2);
  });

  /** Un fallo no deja la puerta trabada: la siguiente llamada vuelve a intentar. */
  it('si la operación falla, la siguiente llamada vuelve a lanzar', async () => {
    let lanzadas = 0;
    const operacion = unaALaVez(async () => {
      lanzadas += 1;
      if (lanzadas === 1) throw new Error('primera falla');
      return 'ok';
    });

    await expect(operacion()).rejects.toThrow('primera falla');
    await expect(operacion()).resolves.toBe('ok');
  });
});
