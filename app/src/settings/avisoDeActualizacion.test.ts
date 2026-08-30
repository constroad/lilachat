import { describe, expect, it } from 'vitest';
import { decidirAvisoDeActualizacion } from './avisoDeActualizacion';

const base = { actual: 37, ultima: 37, minima: 0, version: '0.1.36', descartada: null };

describe('decidirAvisoDeActualizacion', () => {
  it('al día no molesta', () => {
    expect(decidirAvisoDeActualizacion(base)).toEqual({ tipo: 'ninguno' });
  });

  it('hay una más nueva: se sugiere', () => {
    expect(decidirAvisoDeActualizacion({ ...base, ultima: 38, version: '0.1.37' })).toEqual({
      tipo: 'sugerida',
      version: '0.1.37',
    });
  });

  /**
   * **Descartar vale para ESA versión, no para siempre.** Un aviso que se puede
   * apagar de una vez y no vuelve nunca es un aviso que nadie va a ver otra vez;
   * uno que reaparece en cada arranque se apaga en la cabeza de la persona, que
   * es peor.
   */
  it('descartada esa versión, no se repite', () => {
    expect(
      decidirAvisoDeActualizacion({ ...base, ultima: 38, version: '0.1.37', descartada: '0.1.37' })
    ).toEqual({ tipo: 'ninguno' });
  });

  it('pero vuelve con la siguiente', () => {
    expect(
      decidirAvisoDeActualizacion({ ...base, ultima: 39, version: '0.1.38', descartada: '0.1.37' })
    ).toEqual({ tipo: 'sugerida', version: '0.1.38' });
  });

  /**
   * **La obligatoria NO se descarta.** Por debajo del mínimo la app no sirve
   * —el server ya no le habla— así que esconder el aviso solo deja a alguien
   * mirando una app rota sin saber por qué.
   */
  it('por debajo del mínimo es obligatoria, aunque se haya descartado', () => {
    expect(
      decidirAvisoDeActualizacion({
        ...base,
        actual: 30,
        ultima: 38,
        minima: 35,
        version: '0.1.37',
        descartada: '0.1.37',
      })
    ).toEqual({ tipo: 'obligatoria', version: '0.1.37' });
  });

  /**
   * Sin datos no se dice nada. Es la misma regla que `resultadoDelChequeo`: sin
   * respuesta del server, ni «actualizá» ni «estás al día».
   */
  it('sin respuesta del server no se avisa nada', () => {
    expect(decidirAvisoDeActualizacion({ ...base, ultima: null })).toEqual({ tipo: 'ninguno' });
    expect(decidirAvisoDeActualizacion({ ...base, actual: 0, ultima: 38 })).toEqual({
      tipo: 'ninguno',
    });
  });

  /**
   * Una versión más nueva que la publicada es un build de desarrollo. Ofrecerle
   * «actualizar» a una versión vieja sería hacerlo retroceder.
   */
  it('un build más nuevo que el publicado no recibe avisos', () => {
    expect(decidirAvisoDeActualizacion({ ...base, actual: 40, ultima: 38 })).toEqual({
      tipo: 'ninguno',
    });
  });

  /** Sin `version` legible no hay qué mostrar, aunque el número diga que hay una. */
  it('sin la versión legible no se avisa', () => {
    expect(decidirAvisoDeActualizacion({ ...base, ultima: 38, version: '' })).toEqual({
      tipo: 'ninguno',
    });
  });
});
