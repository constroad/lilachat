import { describe, expect, it } from 'vitest';
import { repartirAcciones, type AccionDeBarra } from './barraDeSeleccion';

const TODAS: AccionDeBarra[] = ['responder', 'fijar', 'reenviar', 'eliminar', 'copiar', 'editar', 'info'];

describe('repartirAcciones', () => {
  it('en un teléfono de 360 dp: cuatro a la vista con eliminar, y el resto en «Más»', () => {
    const { visibles, enMenu } = repartirAcciones(TODAS, 360);
    expect(visibles).toEqual(['responder', 'reenviar', 'eliminar', 'fijar', 'copiar']);
    expect(enMenu).toEqual(['editar', 'info']);
  });

  it('con ancho de sobra van todas y no hay «Más»', () => {
    expect(repartirAcciones(TODAS, 420)).toEqual({ visibles: ['responder', 'reenviar', 'eliminar', 'fijar', 'copiar', 'editar', 'info'], enMenu: [] });
  });

  it('eliminar NUNCA va al menú, aunque el ancho sea mínimo', () => {
    const { visibles, enMenu } = repartirAcciones(TODAS, 280);
    expect(visibles).toContain('eliminar');
    expect(enMenu).not.toContain('eliminar');
    expect(visibles.length + enMenu.length).toBe(TODAS.length);
  });

  it('respeta el orden de la barra aunque falten acciones', () => {
    expect(repartirAcciones(['copiar', 'eliminar', 'responder'], 360)).toEqual({ visibles: ['responder', 'eliminar', 'copiar'], enMenu: [] });
  });

  it('lo que no entra sale del final de la prioridad', () => {
    const { enMenu } = repartirAcciones(TODAS, 320);
    expect(enMenu.at(-1)).toBe('info');
  });
});

/** E3 (20/10): «Responder en hilo» va segunda; «Destacar», tercera. En 360 dp, eliminar sigue a la vista. */
describe('con «Responder en hilo» y «Destacar»', () => {
  it('en 360 dp: responder, hilo, destacar, reenviar y eliminar a la vista; fijar y el resto en «Más»', () => {
    const { visibles, enMenu } = repartirAcciones(['responder', 'hilo', 'destacar', 'fijar', 'reenviar', 'eliminar', 'copiar', 'editar', 'info'], 360);
    expect(visibles).toEqual(['responder', 'hilo', 'destacar', 'reenviar', 'eliminar']);
    expect(enMenu).toEqual(['fijar', 'copiar', 'editar', 'info']);
  });
});
