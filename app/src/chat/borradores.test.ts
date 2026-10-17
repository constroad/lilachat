import { describe, expect, it } from 'vitest';
import { conBorrador } from './borradores';

/** Borrador por chat (FL9; auditoría §46.2): lo escrito y no mandado no se pierde. */
describe('conBorrador', () => {
  it('guarda el texto del chat sin tocar los demás', () => {
    const antes = new Map([['c2', 'otro']]);

    expect([...conBorrador(antes, 'c1', 'hola')]).toEqual([['c2', 'otro'], ['c1', 'hola']]);
    expect(antes.has('c1')).toBe(false);
  });

  it('vacío o de espacios: lo saca (mandar o borrar el texto limpia el borrador)', () => {
    expect(conBorrador(new Map([['c1', 'hola']]), 'c1', '   ').has('c1')).toBe(false);
  });
});
