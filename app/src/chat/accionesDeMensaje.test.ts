import { describe, expect, it } from 'vitest';
import { accionesDeMensaje } from './accionesDeMensaje';

/**
 * La pulsación larga (FL9, auditoría §46.2: solo había «Eliminar», de a uno,
 * sin confirmar, y aparecía en mensajes ajenos).
 */
describe('accionesDeMensaje', () => {
  const base = { mio: true, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: true };

  it('un texto propio: todo', () => {
    expect(accionesDeMensaje(base)).toEqual({ responder: true, copiar: true, reenviar: true, editar: true, eliminarParaTodos: true, eliminarParaMi: true });
  });

  it('uno ajeno: no se borra para todos, pero sí para mí', () => {
    expect(accionesDeMensaje({ ...base, mio: false })).toMatchObject({ eliminarParaTodos: false, eliminarParaMi: true });
  });

  it('una foto sin pie: no hay qué copiar; se reenvía el texto, así que tampoco', () => {
    expect(accionesDeMensaje({ ...base, conTexto: false, esMedia: true })).toMatchObject({ copiar: false, reenviar: false, responder: true });
  });

  it('una lápida: solo borrarla de mi vista', () => {
    expect(accionesDeMensaje({ ...base, eliminado: true })).toEqual({ responder: false, copiar: false, reenviar: false, editar: false, eliminarParaTodos: false, eliminarParaMi: true });
  });

  it('chat secreto: no se reenvía (saldría en claro a otro chat)', () => {
    expect(accionesDeMensaje({ ...base, chatSecreto: true })).toMatchObject({ reenviar: false, copiar: true });
  });
});

describe('accionesDeMensaje — editar (José, 17/10/2026)', () => {
  const base = { mio: true, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: true };

  it('se ofrece solo si el motor compartido lo permite (propio, texto, < 15 min)', () => {
    expect(accionesDeMensaje(base).editar).toBe(true);
    expect(accionesDeMensaje({ ...base, editable: false }).editar).toBe(false);
  });
});
