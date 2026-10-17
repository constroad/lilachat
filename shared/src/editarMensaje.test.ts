import { describe, expect, it } from 'vitest';
import { puedeEditar, VENTANA_DE_EDICION_MS } from './editarMensaje.js';

/**
 * Editar un mensaje (pedido de José, 17/10/2026). Como WhatsApp: solo lo
 * propio, solo texto, y por un rato (15 min).
 */
describe('puedeEditar', () => {
  const ahora = Date.parse('2026-10-17T20:00:00Z');
  const base = { yo: 'jose', autor: 'jose', kind: 'text', eliminado: false, secreto: false, enviadoEn: ahora - 60_000, ahora };

  it('un texto propio recién mandado: sí', () => {
    expect(puedeEditar(base)).toEqual({ permitido: true });
  });

  it('lo de otro: no', () => {
    expect(puedeEditar({ ...base, autor: 'ana' })).toEqual({ permitido: false, motivo: 'Solo puedes editar tus propios mensajes.' });
  });

  it('una foto, una nota de voz o un aviso: no', () => {
    expect(puedeEditar({ ...base, kind: 'image' }).permitido).toBe(false);
    expect(puedeEditar({ ...base, kind: 'system' }).permitido).toBe(false);
  });

  it('borrado: no', () => {
    expect(puedeEditar({ ...base, eliminado: true }).permitido).toBe(false);
  });

  it('pasados los 15 minutos: no, y lo dice', () => {
    expect(puedeEditar({ ...base, enviadoEn: ahora - VENTANA_DE_EDICION_MS - 1 })).toEqual({
      permitido: false,
      motivo: 'Pasaron más de 15 minutos: ya no se puede editar.',
    });
    expect(puedeEditar({ ...base, enviadoEn: ahora - VENTANA_DE_EDICION_MS }).permitido).toBe(true);
  });

  it('en un chat secreto todavía no (el texto viaja cifrado)', () => {
    expect(puedeEditar({ ...base, secreto: true }).permitido).toBe(false);
  });

  it('acepta la fecha como texto ISO (como llega al teléfono)', () => {
    expect(puedeEditar({ ...base, enviadoEn: new Date(ahora - 60_000).toISOString() }).permitido).toBe(true);
  });
});
