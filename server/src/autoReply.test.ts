import { describe, expect, it } from 'vitest';
import { debeAutoResponder } from './autoReply.js';

const ahora = new Date('2026-01-01T12:00:00Z');
const base = {
  chatKind: 'direct' as const,
  habilitado: true,
  entranteEsAutoReply: false,
  ultimoAt: null,
  now: ahora,
};

describe('debeAutoResponder', () => {
  it('1:1, habilitado, sin haber respondido antes → sí', () => {
    expect(debeAutoResponder(base)).toBe(true);
  });

  it('deshabilitado → no', () => {
    expect(debeAutoResponder({ ...base, habilitado: false })).toBe(false);
  });

  it('a un GRUPO no: un aviso de ausente ahí es ruido para todos', () => {
    expect(debeAutoResponder({ ...base, chatKind: 'group' })).toBe(false);
  });

  it('al entrante que ES un auto-reply no: corta el loop entre dos ausentes', () => {
    expect(debeAutoResponder({ ...base, entranteEsAutoReply: true })).toBe(false);
  });

  it('si ya respondí a este chat hace 30 min → no (rate-limit de 2 h)', () => {
    const hace30 = new Date(ahora.getTime() - 30 * 60_000);
    expect(debeAutoResponder({ ...base, ultimoAt: hace30 })).toBe(false);
  });

  it('si la última fue hace más de 2 h → sí de nuevo', () => {
    const hace3h = new Date(ahora.getTime() - 3 * 3600_000);
    expect(debeAutoResponder({ ...base, ultimoAt: hace3h })).toBe(true);
  });
});
