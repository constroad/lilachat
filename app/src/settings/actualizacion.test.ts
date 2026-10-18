import { describe, expect, it } from 'vitest';
import { resultadoDelChequeo } from './actualizacion';

/**
 * «Verificar si hay actualizaciones». El texto de la invitación se mudó a
 * `shared/src/invitacion.ts` (FL13).
 *
 * Los dos los pidió José el 26/08/2026, y los dos tienen la misma trampa: dar
 * por buena una respuesta que nunca llegó.
 */
describe('resultadoDelChequeo', () => {
  it('hay una más nueva: la ofrece', () => {
    expect(resultadoDelChequeo({ actual: 4, ultima: 5, version: '0.1.4' })).toEqual({
      estado: 'hay-nueva',
      version: '0.1.4',
    });
  });

  it('la misma: al día', () => {
    expect(resultadoDelChequeo({ actual: 5, ultima: 5, version: '0.1.5' })).toEqual({
      estado: 'al-dia',
    });
  });

  /** Un APK de prueba más nuevo que lo publicado no es un error. */
  it('más nueva que la publicada: al día', () => {
    expect(resultadoDelChequeo({ actual: 9, ultima: 5, version: '0.1.5' })).toEqual({
      estado: 'al-dia',
    });
  });

  /**
   * **Sin respuesta NO es «estás al día».** Decirlo deja a alguien en una
   * versión rota convencido de que no hay nada que hacer.
   */
  it('sin respuesta: no se pudo', () => {
    expect(resultadoDelChequeo({ actual: 4, ultima: null, version: '' })).toEqual({
      estado: 'no-se-pudo',
    });
  });

  it('sin saber qué versión corro: no se pudo', () => {
    expect(resultadoDelChequeo({ actual: 0, ultima: 5, version: '0.1.5' })).toEqual({
      estado: 'no-se-pudo',
    });
  });
});

/**
 * El mensaje que se le manda a quien todavía no tiene la app.
 *
 * Lleva **las dos** puertas de entrada, y en ese orden: la tienda es la que deja
 * la app actualizándose sola después; el APK directo es el atajo para quien no
 * quiere instalar dos cosas. Ofrecer solo la tienda pierde a quien se cansa en
 * el segundo paso; ofrecer solo el APK deja a esa persona sin actualizaciones
 * para siempre.
 */
