import { describe, expect, it } from 'vitest';
import { caminoDelQr } from './caminoDelQr';

const URL_DEL_QR = 'https://lilachat.constroad.com/v/q3VhZ0Jb1xR4mN8pLw2sT6yE9cK0aZfH5dUiOjXgB7v';

describe('caminoDelQr', () => {
  it('arma UN camino SVG con los módulos oscuros, del tamaño del QR', () => {
    const qr = caminoDelQr(URL_DEL_QR);
    // Corrección Q (aguanta el logo encima) y ~76 caracteres: versión 7, sin pasarse de denso.
    expect(qr.modulos).toBe(45);
    expect(qr.d.startsWith('M')).toBe(true);
    // Los tres ojos de posición: la esquina de arriba a la izquierda es oscura.
    expect(qr.d).toContain('M0 0h');
  });

  it('otro token, otro dibujo', () => {
    expect(caminoDelQr(URL_DEL_QR).d).not.toBe(caminoDelQr(URL_DEL_QR.replace('q3', 'z9')).d);
  });
});
