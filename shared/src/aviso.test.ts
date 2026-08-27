import { describe, expect, it } from 'vitest';
import { armarAviso } from './aviso.js';

/**
 * La burbuja que asoma arriba cuando llega un mensaje, como WhatsApp.
 *
 * José, 26/08/2026: «debería poder ver parte del mensaje en la burbuja superior
 * del teléfono como lo hace WhatsApp».
 *
 * Lo que este motor decide es qué se muestra — y sobre todo, **qué no**.
 */
const base = { chatName: 'Familia', senderName: 'Mamá', kind: 'text' as const };

describe('armarAviso', () => {
  it('en un grupo, quién habló va adelante del texto', () => {
    expect(armarAviso({ ...base, esGrupo: true, body: 'llego tarde' })).toEqual({
      titulo: 'Familia',
      cuerpo: 'Mamá: llego tarde',
    });
  });

  /** En un 1:1 el título YA es la persona: repetir el nombre es ruido. */
  it('en un chat directo no se repite el nombre', () => {
    expect(armarAviso({ ...base, chatName: 'Mamá', esGrupo: false, body: 'llego tarde' })).toEqual({
      titulo: 'Mamá',
      cuerpo: 'llego tarde',
    });
  });

  /**
   * **Un mensaje cifrado NO se muestra.** El chat secreto existe para que ni el
   * server lo lea; filtrarlo en la pantalla de bloqueo, donde lo ve cualquiera
   * que mire el teléfono, sería tirar por la borda justo eso.
   */
  it('un chat secreto no muestra el texto', () => {
    const aviso = armarAviso({ ...base, esGrupo: false, body: 'secreto', cifrado: true });

    expect(aviso.cuerpo).not.toContain('secreto');
    expect(aviso.cuerpo).toMatch(/mensaje/i);
  });

  it('una foto se anuncia como foto, no como texto vacío', () => {
    expect(armarAviso({ ...base, esGrupo: false, kind: 'image', body: '' }).cuerpo).toMatch(/foto/i);
  });

  /**
   * La burbuja muestra dos líneas: un mensaje larguísimo se corta acá y no lo
   * corta Android a mitad de palabra.
   */
  it('un mensaje largo se recorta con puntos', () => {
    const largo = 'a'.repeat(500);
    const aviso = armarAviso({ ...base, esGrupo: false, body: largo });

    expect(aviso.cuerpo.length).toBeLessThanOrEqual(140);
    expect(aviso.cuerpo.endsWith('…')).toBe(true);
  });

  /** Sin nombre del que escribe no se pone «undefined» en la pantalla. */
  it('sin nombre del remitente, el aviso sigue teniendo sentido', () => {
    const aviso = armarAviso({ ...base, senderName: null, esGrupo: true, body: 'hola' });

    expect(aviso.cuerpo).not.toMatch(/undefined|null/);
    expect(aviso.cuerpo).toContain('hola');
  });
});
