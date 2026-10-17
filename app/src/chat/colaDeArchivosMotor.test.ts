import { describe, expect, it } from 'vitest';
import { decidirSubida, siguienteArchivo, type ArchivoEnCola } from './colaDeArchivosMotor';

/**
 * Fotos, archivos y notas de voz a una cola PERSISTIDA (FL8; auditoría
 * 17/10/2026: sin red fallaban, la burbuja desaparecía y quedaba un texto rojo;
 * cerrar la app los perdía). Mismas reglas que la cola de texto.
 */
const archivo = (extra: Partial<ArchivoEnCola> = {}): ArchivoEnCola => ({
  clientKey: 'k1',
  chatId: '6a90cf90d2dbc98541f59dd0',
  uri: 'file:///data/cola-archivos/k1.jpg',
  fileName: 'foto.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 120_000,
  queuedAt: '2026-10-17T15:00:00.000Z',
  intentos: 0,
  ...extra,
});

describe('decidirSubida', () => {
  it('subida OK: se confirma (sale de la cola y se borra la copia)', () => {
    expect(decidirSubida({ ok: true, seq: 4, url: 'https://x' }, archivo())).toEqual({ accion: 'confirmar' });
  });

  it('sin red o storage caído: se reintenta con espera creciente, nunca se pierde', () => {
    expect(decidirSubida({ ok: false, reason: 'Sin conexión', retryable: true }, archivo({ intentos: 2 }))).toEqual({
      accion: 'reintentar',
      esperaMs: 2_000,
    });
  });

  it('rechazo permanente (muy grande, tipo no permitido, chat secreto): FALLA con el motivo, no desaparece', () => {
    expect(decidirSubida({ ok: false, reason: 'El archivo pesa más de 50 MB.', retryable: false }, archivo())).toEqual({
      accion: 'fallar',
      motivo: 'El archivo pesa más de 50 MB.',
    });
  });
});

describe('siguienteArchivo', () => {
  it('en orden, salteando los fallidos', () => {
    const cola = [archivo({ clientKey: 'a', fallo: 'x' }), archivo({ clientKey: 'b' }), archivo({ clientKey: 'c' })];

    expect(siguienteArchivo(cola)?.clientKey).toBe('b');
  });

  it('vacía o todo fallido: nada', () => {
    expect(siguienteArchivo([])).toBeNull();
    expect(siguienteArchivo([archivo({ fallo: 'x' })])).toBeNull();
  });
});
