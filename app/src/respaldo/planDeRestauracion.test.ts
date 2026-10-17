import { describe, expect, it } from 'vitest';
import { decidirOferta, descripcionDeRestauracion, descripcionDeRespaldo, verificarDescarga } from './planDeRestauracion';

/**
 * Restaurar en un teléfono nuevo (F12.2), lo PURO: cuándo se ofrece, cómo se
 * describe el respaldo que hay, y que lo bajado sea lo que el server dijo.
 */
describe('decidirOferta', () => {
  it('se ofrece cuando hay respaldo, el almacén está vacío y todavía no se ofreció', () => {
    expect(decidirOferta({ hayRespaldo: true, almacenVacio: true, yaOfrecido: false })).toBe('ofrecer');
  });

  /** Un teléfono con historial no pisa lo que tiene por un respaldo viejo: se restaura a mano desde Ajustes. */
  it('con mensajes en el teléfono no se ofrece sola', () => {
    expect(decidirOferta({ hayRespaldo: true, almacenVacio: false, yaOfrecido: false })).toBe('nada');
  });

  it('sin respaldo en la mini no hay nada que ofrecer', () => {
    expect(decidirOferta({ hayRespaldo: false, almacenVacio: true, yaOfrecido: false })).toBe('nada');
  });

  /** Se ofrece UNA vez: quien dijo «ahora no» no lo ve en cada arranque. */
  it('si ya se ofreció, no se vuelve a ofrecer', () => {
    expect(decidirOferta({ hayRespaldo: true, almacenVacio: true, yaOfrecido: true })).toBe('nada');
  });
});

describe('descripcionDeRespaldo', () => {
  it('dice de cuándo es y cuánto pesa, en el idioma de la persona', () => {
    const texto = descripcionDeRespaldo({ creadoEn: '2026-09-15T22:03:09.000Z', bytes: 1_200_000 }, 'America/Lima');

    expect(texto).toBe('del 15/09/2026 · 1,2 MB');
  });

  it('un respaldo chico se describe en KB', () => {
    expect(descripcionDeRespaldo({ creadoEn: '2026-01-02T03:04:05.000Z', bytes: 8_500 }, 'America/Lima')).toBe('del 01/01/2026 · 8,5 KB');
  });
});

describe('verificarDescarga', () => {
  it('lo bajado sirve si la huella coincide con la que anunció el server', () => {
    expect(verificarDescarga({ esperada: 'a'.repeat(64), calculada: 'a'.repeat(64) })).toBe(true);
  });

  /** Un archivo truncado por un corte de red no se intenta abrir: se dice y se vuelve a bajar. */
  it('si no coincide, no sirve', () => {
    expect(verificarDescarga({ esperada: 'a'.repeat(64), calculada: 'b'.repeat(64) })).toBe(false);
  });
});

/**
 * FL5: restaurar ya no pisa lo que el teléfono tiene y cuenta lo escrito de
 * verdad. Con todo ya guardado eso da 0, y «0 mensajes de vuelta» se leía como
 * una falla.
 */
describe('descripcionDeRestauracion', () => {
  it('cuenta los mensajes que volvieron', () => {
    expect(descripcionDeRestauracion({ chats: 2, mensajes: 40 })).toBe('Listo: 2 chats y 40 mensajes de vuelta en el teléfono.');
  });

  it('singular cuando es uno', () => {
    expect(descripcionDeRestauracion({ chats: 1, mensajes: 1 })).toBe('Listo: 1 chat y 1 mensaje de vuelta en el teléfono.');
  });

  it('con todo ya en el teléfono lo dice, en vez de «0 mensajes»', () => {
    expect(descripcionDeRestauracion({ chats: 2, mensajes: 0 })).toBe('Listo: el teléfono ya tenía todo lo del respaldo.');
  });
});
