import { describe, expect, it } from 'vitest';
import { seqParaAcusar } from './acuseDeLeido';

const m = (seq: number, senderId: string, estado?: 'enviando' | 'fallido') => ({ seq, senderId, estado });

describe('seqParaAcusar', () => {
  it('acusa hasta el último confirmado, aunque sea mío o una línea de sistema', () => {
    // Auditoría 19/10: solo se acusaba hasta el último AJENO; mi línea «Fijaste…» quedaba sin leer.
    expect(seqParaAcusar({ mensajes: [m(3, 'otro'), m(4, 'yo')], ultimoAvisado: 0, visible: true, pegado: true })).toBe(4);
  });

  it('lo que todavía viaja no cuenta', () => {
    expect(seqParaAcusar({ mensajes: [m(3, 'otro'), m(Number.MAX_SAFE_INTEGER, 'yo', 'enviando')], ultimoAvisado: 0, visible: true, pegado: true })).toBe(3);
  });

  it('con la pestaña oculta o leyendo más arriba, nada', () => {
    expect(seqParaAcusar({ mensajes: [m(3, 'otro')], ultimoAvisado: 0, visible: false, pegado: true })).toBeNull();
    expect(seqParaAcusar({ mensajes: [m(3, 'otro')], ultimoAvisado: 0, visible: true, pegado: false })).toBeNull();
  });

  it('lo ya acusado no se repite', () => {
    expect(seqParaAcusar({ mensajes: [m(3, 'otro')], ultimoAvisado: 3, visible: true, pegado: true })).toBeNull();
  });
});
