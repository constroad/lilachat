import { describe, expect, it } from 'vitest';
import { decidirSubida, paraPersistir, siguienteArchivo, type ArchivoEnCola } from './colaDeArchivosMotor';
import { keepsLocalCopy } from './colaDeArchivosMotor';

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

  /** Auditoría (19/10): la burbuja sale antes de copiar; mientras se copia, no se sube (ni lo de atrás). */
  it('el primero todavía se está copiando: espera, sin adelantar a los de atrás', () => {
    const cola = [archivo({ clientKey: 'a', preparando: true }), archivo({ clientKey: 'b' })];

    expect(siguienteArchivo(cola)).toBeNull();
  });
});

describe('paraPersistir', () => {
  it('lo que se está copiando no se guarda: su uri es de la caché, que el sistema limpia', () => {
    const cola = [archivo({ clientKey: 'a', preparando: true }), archivo({ clientKey: 'b' })];

    expect(paraPersistir(cola).map((uno) => uno.clientKey)).toEqual(['b']);
  });
});

describe('keepsLocalCopy (José 13/11: «en el preview no se ve el sello»)', () => {
  it('a plain photo keeps its copy on the phone for the bubble and the viewer', () => {
    // Act / Assert
    expect(keepsLocalCopy(archivo())).toBe(true);
  });

  it('a shot the server stamps does not: the copy has no stamp, so the bubble and the viewer read the stamped file', () => {
    // Act / Assert
    expect(keepsLocalCopy(archivo({ stamp: { timemark: true, point: null, logo: true, takenAt: '2026-11-13T15:00:00.000Z' } }))).toBe(false);
  });

  it('a file still being prepared never keeps one', () => {
    // Act / Assert
    expect(keepsLocalCopy(archivo({ preparando: true }))).toBe(false);
  });
});
