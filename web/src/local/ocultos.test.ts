import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BaseLocal } from './baseLocal';
import { hideManyLocally, ocultar, ocultosDe } from './ocultos';

let base: BaseLocal;
let numero = 0;
const nuevaBase = () => (base = new BaseLocal(`ocultos-${(numero += 1)}`));

afterEach(async () => {
  base.close();
  await base.delete();
});

/** «Eliminar para mí»: hidden in this browser at once; the server keeps it for my other devices (13/11). */
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

  it('what another device hid merges with what this one had, without repeats (José, 13/11)', async () => {
    nuevaBase();
    await ocultar(base, 'c1', 5);
    await hideManyLocally(base, 'c1', [5, 9, 12]);

    expect([...(await ocultosDe(base, 'c1'))].sort((a, b) => a - b)).toEqual([5, 9, 12]);
  });
});
