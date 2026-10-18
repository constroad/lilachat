import { describe, expect, it } from 'vitest';
import { repartirPorToken } from './repartoDePush.js';

/**
 * FL11 (José, 18/10, teléfono real): avisos duplicados en dos formatos y uno
 * por mensaje. Su teléfono figuraba en DOS devices con el mismo token de FCM,
 * uno nativo y uno viejo: le llegaban el push de datos (agrupado por chat) y
 * el común (uno por mensaje). Y un token viejo repetido en 6 devices recibía 6
 * copias.
 */
describe('repartirPorToken', () => {
  const nativo = (token: string) => ({ pushToken: token, nativo: true });
  const comun = (token: string) => ({ pushToken: token, nativo: false });
  const esNativo = (d: { nativo: boolean }) => d.nativo;

  it('un token de un device nativo no recibe además el push común', () => {
    const { nativos, comunes } = repartirPorToken([nativo('t1'), comun('t1')], esNativo);

    expect(nativos.map((d) => d.pushToken)).toEqual(['t1']);
    expect(comunes).toEqual([]);
  });

  it('un token repetido en varios devices va una sola vez', () => {
    const { nativos, comunes } = repartirPorToken([comun('t2'), comun('t2'), comun('t2'), nativo('t3'), nativo('t3')], esNativo);

    expect(comunes.map((d) => d.pushToken)).toEqual(['t2']);
    expect(nativos.map((d) => d.pushToken)).toEqual(['t3']);
  });

  it('sin token no se manda nada', () => {
    expect(repartirPorToken([{ nativo: true }, { pushToken: '', nativo: false }], esNativo)).toEqual({ nativos: [], comunes: [] });
  });
});
