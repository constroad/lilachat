import { describe, expect, it } from 'vitest';
import { avisarTarjeta, refrescarTodas, suscribirTarjeta } from './tarjetasVivas.js';

/** José, 19/10: un voto o un borrado se veía recién al reabrir el chat. */
describe('tarjetasVivas', () => {
  it('el aviso del server llega solo a la tarjeta de ESE tipo e id', () => {
    const llamadas: string[] = [];
    const soltarA = suscribirTarjeta('encuesta', 'p1', () => llamadas.push('p1'));
    const soltarB = suscribirTarjeta('encuesta', 'p2', () => llamadas.push('p2'));
    const soltarC = suscribirTarjeta('evento', 'p1', () => llamadas.push('evento-p1'));

    avisarTarjeta({ chatId: 'c1', tipo: 'encuesta', id: 'p1' });

    expect(llamadas).toEqual(['p1']);
    soltarA();
    soltarB();
    soltarC();
  });

  it('la misma tarjeta montada dos veces (celda reciclada) se entera las dos', () => {
    let veces = 0;
    const soltarA = suscribirTarjeta('recordatorio', 'r1', () => (veces += 1));
    const soltarB = suscribirTarjeta('recordatorio', 'r1', () => (veces += 1));

    avisarTarjeta({ chatId: 'c1', tipo: 'recordatorio', id: 'r1' });

    expect(veces).toBe(2);
    soltarA();
    soltarB();
  });

  it('soltada, ya no se entera', () => {
    let veces = 0;
    const soltar = suscribirTarjeta('evento', 'e1', () => (veces += 1));
    soltar();

    avisarTarjeta({ chatId: 'c1', tipo: 'evento', id: 'e1' });

    expect(veces).toBe(0);
  });

  it('al reconectar se refrescan TODAS: lo que pasó sin socket no se perdió', () => {
    const llamadas: string[] = [];
    const soltarA = suscribirTarjeta('encuesta', 'p1', () => llamadas.push('p1'));
    const soltarB = suscribirTarjeta('evento', 'e1', () => llamadas.push('e1'));

    refrescarTodas();

    expect(llamadas.sort()).toEqual(['e1', 'p1']);
    soltarA();
    soltarB();
  });

  it('un aviso con forma rara no rompe nada', () => {
    expect(() => avisarTarjeta(null)).not.toThrow();
    expect(() => avisarTarjeta({ tipo: 'otra', id: 3 })).not.toThrow();
  });
});
