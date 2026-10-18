import { describe, expect, it } from 'vitest';
import { cuerpoDelAviso, idDeAvisoDeChat, sumarLineaAlAviso, tituloDelAviso } from './avisosPorChat';

/**
 * FL11 (José, 18/10): «las notificaciones te crea uno por mensaje y no los
 * agrupa como WhatsApp». El aviso local (app viva) ahora es UNO por chat: el
 * nuevo reemplaza al anterior y junta las últimas líneas.
 */
describe('avisosPorChat', () => {
  it('un identificador por chat: el aviso nuevo reemplaza al anterior', () => {
    expect(idDeAvisoDeChat('c1')).toBe(idDeAvisoDeChat('c1'));
    expect(idDeAvisoDeChat('c1')).not.toBe(idDeAvisoDeChat('c2'));
  });

  it('junta las últimas cinco líneas, de la más vieja a la más nueva', () => {
    let lineas: string[] = [];
    for (let n = 1; n <= 7; n += 1) lineas = sumarLineaAlAviso(lineas, `m${n}`);

    expect(lineas).toEqual(['m3', 'm4', 'm5', 'm6', 'm7']);
    expect(cuerpoDelAviso(lineas)).toBe('m3\nm4\nm5\nm6\nm7');
  });

  it('el título dice cuántos mensajes hay, desde dos', () => {
    expect(tituloDelAviso('Wilson', 1)).toBe('Wilson');
    expect(tituloDelAviso('Wilson', 3)).toBe('Wilson · 3 mensajes');
  });
});
