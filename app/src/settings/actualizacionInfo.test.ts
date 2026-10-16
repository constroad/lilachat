import { describe, expect, it } from 'vitest';
import { hayConQueActualizar, infoParaActualizar } from './actualizacionInfo';

const completo = {
  downloadUrl: 'https://lilastore.constroad.com/d/r1',
  releaseId: 'r1',
  sha256: 'a'.repeat(64),
  size: 52984415,
};

describe('hayConQueActualizar', () => {
  it('con URL, hash, tamaño y releaseId, se puede autoactualizar', () => {
    expect(hayConQueActualizar(completo)).toBe(true);
  });

  it('sin sha256 no se instala (no hay con qué verificar → falla cerrado)', () => {
    expect(hayConQueActualizar({ ...completo, sha256: '' })).toBe(false);
  });

  it('sin URL de descarga, no', () => {
    expect(hayConQueActualizar({ ...completo, downloadUrl: '' })).toBe(false);
  });

  it('tamaño 0 (server viejo sin el campo) no alcanza', () => {
    expect(hayConQueActualizar({ ...completo, size: 0 })).toBe(false);
  });

  it('sin releaseId no hay dónde guardarlo con nombre propio', () => {
    expect(hayConQueActualizar({ ...completo, releaseId: '' })).toBe(false);
  });
});

/**
 * La banda «Actualizar» usaba la versión capturada al ABRIR la app. Con varias
 * publicaciones seguidas ofrecía una vieja (16/10: seis versiones en tres horas).
 * Al tocar se vuelve a preguntar; sin respuesta, se usa la guardada.
 */
describe('infoParaActualizar', () => {
  it('con respuesta fresca completa, gana la fresca', () => {
    const fresca = { ...completo, releaseId: 'r2', downloadUrl: 'https://lilastore.constroad.com/d/r2' };
    expect(infoParaActualizar(fresca, completo)).toBe(fresca);
  });

  it('sin red (respuesta vacía), queda la guardada', () => {
    const vacia = { downloadUrl: '', releaseId: '', sha256: '', size: 0 };
    expect(infoParaActualizar(vacia, completo)).toBe(completo);
  });
});
