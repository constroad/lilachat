import { describe, expect, it } from 'vitest';
import { porLotes } from './lotes.js';

/** FL5: trabajo largo en el hilo de JS, partido en lotes que ceden entre sí. */
describe('porLotes', () => {
  it('pasa todos los elementos, en orden y en lotes del tamaño pedido', async () => {
    const vistos: number[][] = [];
    await porLotes([1, 2, 3, 4, 5], 2, async (lote) => void vistos.push([...lote]), async () => undefined);

    expect(vistos).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('cede ENTRE lotes, no después del último', async () => {
    const pasos: string[] = [];
    await porLotes([1, 2, 3], 1, async (lote) => void pasos.push(`lote ${lote[0]}`), async () => void pasos.push('cede'));

    expect(pasos).toEqual(['lote 1', 'cede', 'lote 2', 'cede', 'lote 3']);
  });

  it('suma lo que devuelve cada lote (filas escritas de verdad)', async () => {
    const total = await porLotes([1, 2, 3, 4], 3, async (lote) => lote.length - 1, async () => undefined);

    expect(total).toBe(2 + 0);
  });

  it('vacío: no llama a la tarea y da 0', async () => {
    let llamadas = 0;
    const total = await porLotes([], 10, async () => (llamadas += 1), async () => undefined);

    expect(total).toBe(0);
    expect(llamadas).toBe(0);
  });

  it('un error en un lote se propaga y corta: no se escribe la mitad en silencio', async () => {
    const vistos: number[] = [];
    const corrida = porLotes(
      [1, 2, 3],
      1,
      async ([n]) => {
        if (n === 2) throw new Error('disco lleno');
        vistos.push(n!);
      },
      async () => undefined
    );

    await expect(corrida).rejects.toThrow('disco lleno');
    expect(vistos).toEqual([1]);
  });

  it('un tamaño inválido se trata como 1, no como un bucle infinito', async () => {
    const vistos: number[][] = [];
    await porLotes([1, 2], 0, async (lote) => void vistos.push([...lote]), async () => undefined);

    expect(vistos).toEqual([[1], [2]]);
  });
});
