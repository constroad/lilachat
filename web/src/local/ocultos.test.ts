import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BaseLocal } from './baseLocal';
import { ocultar, ocultosDe } from './ocultos';

let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`ocultos-${(numero += 1)}`));

afterEach(async () => {
  base.close();
  await base.delete();
});

/** «Eliminar para mí» (como la app): se oculta en ESTE navegador, el server no se entera. */
describe('ocultos', () => {
  it('ocultar uno lo agrega al chat, sin repetir', async () => {
    nuevaBase();
    await ocultar(base, 'c1', 5);
    await ocultar(base, 'c1', 5);
    await ocultar(base, 'c1', 7);

    expect([...(await ocultosDe(base, 'c1'))].sort()).toEqual([5, 7]);
  });

  it('cada chat tiene los suyos', async () => {
    nuevaBase();
    await ocultar(base, 'c1', 5);

    expect((await ocultosDe(base, 'c2')).size).toBe(0);
  });
});
