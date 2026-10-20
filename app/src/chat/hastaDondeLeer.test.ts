import { describe, expect, it } from 'vitest';
import { hastaDondeLeer } from './hastaDondeLeer';

describe('hastaDondeLeer', () => {
  it('en primer plano, hasta el último cargado', () => {
    expect(hastaDondeLeer({ mensajes: [{ seq: 3 }, { seq: 5 }], enPrimerPlano: true })).toBe(5);
  });

  it('si el server dijo que hay más (el último se borró en duro), hasta ahí', () => {
    expect(hastaDondeLeer({ mensajes: [{ seq: 3 }], lastSeqInicial: 4, enPrimerPlano: true })).toBe(4);
  });

  it('en segundo plano no se lee nada, aunque lleguen mensajes', () => {
    expect(hastaDondeLeer({ mensajes: [{ seq: 9 }], lastSeqInicial: 9, enPrimerPlano: false })).toBeNull();
  });

  it('un chat vacío no acusa', () => {
    expect(hastaDondeLeer({ mensajes: [], enPrimerPlano: true })).toBeNull();
  });
});
