import { describe, expect, it } from 'vitest';
import { resultadoDelChequeo, textoDeInvitacion } from './actualizacion';

/**
 * «Verificar si hay actualizaciones» y el texto de la invitación.
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
describe('textoDeInvitacion', () => {
  const enlaces = {
    tienda: 'https://lilastore.constroad.com/get',
    app: 'https://lilastore.constroad.com/d/abc',
  };

  it('nombra a quien invita, para que no parezca spam', () => {
    expect(textoDeInvitacion({ ...enlaces, deParte: 'José' })).toContain('José');
  });

  it('lleva las dos puertas', () => {
    const texto = textoDeInvitacion({ ...enlaces, deParte: 'José' });
    expect(texto).toContain(enlaces.tienda);
    expect(texto).toContain(enlaces.app);
  });

  /** Sin nombre no se escribe «te invitó undefined». */
  it('sin nombre, el mensaje sigue teniendo sentido', () => {
    const texto = textoDeInvitacion({ ...enlaces, deParte: null });
    expect(texto).not.toMatch(/undefined|null/);
    expect(texto).toContain(enlaces.tienda);
  });

  /** Si no hay APK publicado, no se manda un enlace roto. */
  it('sin enlace directo, solo va la tienda', () => {
    const texto = textoDeInvitacion({ tienda: enlaces.tienda, app: '', deParte: 'José' });
    expect(texto).toContain(enlaces.tienda);
    expect(texto).not.toContain('/d/');
  });
});

/**
 * El texto ya no habla de «la familia» (27/08/2026).
 *
 * Decía «Lilachat, el chat de la familia», y quedó viejo al abrir el registro:
 * el mensaje lo lee gente que no es de la familia de nadie. Se dice qué ES, no
 * para quién.
 */
describe('textoDeInvitacion — sin «familia»', () => {
  const enlaces = { tienda: 'https://t.test/get', app: 'https://t.test/d/abc' };

  it('no habla de la familia de nadie', () => {
    const texto = textoDeInvitacion({ ...enlaces, deParte: 'José' });

    expect(texto.toLowerCase()).not.toContain('familia');
  });

  /** Dice qué es la app: sin eso, un enlace suelto parece spam. */
  it('explica qué es Lilachat', () => {
    const texto = textoDeInvitacion({ ...enlaces, deParte: null });

    expect(texto).toMatch(/mensajer/i);
    expect(texto).toMatch(/chats|grupos|eventos/i);
  });
});
