import { describe, expect, it } from 'vitest';
import { divisorDesdeLeido, seqDelDivisor } from './divisorNoLeidos';

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

/**
 * Auditoría (19/10): el server cuenta como no leídos también mis mensajes y los
 * avisos (lastSeq − readSeq); contando solo los ajenos desde el final, el
 * divisor quedaba MÁS ARRIBA. Con el `readSeq` del server va justo después.
 */
describe('divisorDesdeLeido', () => {
  const filas = [
    { seq: 1, senderId: 'otro', kind: 'text' },
    { seq: 2, senderId: 'yo', kind: 'text' },
    { seq: 3, senderId: 'otro', kind: 'system' },
    { seq: 4, senderId: 'otro', kind: 'text' },
    { seq: 5, senderId: 'yo', kind: 'text' },
    { seq: 6, senderId: 'otro', kind: 'image' },
  ];

  it('arriba del primer mensaje ajeno después de lo leído, con cuántos son', () => {
    expect(divisorDesdeLeido(filas, 'yo', 2)).toEqual({ seq: 4, cantidad: 2 });
  });

  it('si lo nuevo es solo mío o avisos, no hay divisor', () => {
    expect(divisorDesdeLeido(filas.slice(0, 3), 'yo', 1)).toBeNull();
  });

  it('todo leído: no hay divisor', () => {
    expect(divisorDesdeLeido(filas, 'yo', 6)).toBeNull();
  });
});
