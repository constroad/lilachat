import { describe, expect, it } from 'vitest';
import { hayConQueActualizar } from './actualizacionInfo';

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
