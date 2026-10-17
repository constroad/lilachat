import { describe, expect, it } from 'vitest';
import { seqDelDivisor } from './divisorNoLeidos';

/** «N mensajes no leídos» donde empiezan los nuevos (FL9, auditoría §46.2). */
describe('seqDelDivisor', () => {
  const filas = [
    { seq: 1, senderId: 'otro' },
    { seq: 2, senderId: 'yo' },
    { seq: 3, senderId: 'otro' },
    { seq: 4, senderId: 'otro', kind: 'system' },
    { seq: 5, senderId: 'otro' },
  ];

  it('va antes del primero de los N no leídos, contando solo lo ajeno y sin avisos', () => {
    expect(seqDelDivisor(filas, 'yo', 2)).toBe(3);
    expect(seqDelDivisor(filas, 'yo', 1)).toBe(5);
  });

  it('sin no leídos, no hay divisor', () => {
    expect(seqDelDivisor(filas, 'yo', 0)).toBeNull();
  });

  it('más no leídos que mensajes cargados: arriba del primero ajeno que hay', () => {
    expect(seqDelDivisor(filas, 'yo', 10)).toBe(1);
  });
});
