import { describe, expect, it } from 'vitest';
import { formaDelTexto } from './campoDeTexto';

/**
 * FL12 (§49 #15): el campo ya no es controlado. La barra solo se redibuja
 * cuando cambia su FORMA —vacío o no, con texto o solo espacios—, no por tecla.
 */
describe('formaDelTexto', () => {
  it('vacío: se ven el clip y la cámara, y el micrófono', () => {
    expect(formaDelTexto('')).toEqual({ vacio: true, conTexto: false });
  });

  it('solo espacios: no está vacío, pero no hay qué enviar', () => {
    expect(formaDelTexto('   ')).toEqual({ vacio: false, conTexto: false });
  });

  it('con texto: aparece enviar', () => {
    expect(formaDelTexto(' hola ')).toEqual({ vacio: false, conTexto: true });
  });
});
