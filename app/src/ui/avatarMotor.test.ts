import { describe, expect, it } from 'vitest';
import { inicialesDe, tonoDeAvatar } from './avatarMotor';

/**
 * Un solo avatar en toda la app (FL13, auditoría §48: lavanda con una letra en
 * la lista, violeta sólido en «Nuevo chat»). Como el diseño FL6: dos iniciales
 * y un tono por persona.
 */
describe('inicialesDe', () => {
  it('nombre y apellido: las dos iniciales', () => {
    expect(inicialesDe('Ana Torres')).toBe('AT');
    expect(inicialesDe('wilson  zamora quispe')).toBe('WZ');
  });

  it('una sola palabra: sus dos primeras letras', () => {
    expect(inicialesDe('Familia')).toBe('FA');
    expect(inicialesDe('Ñ')).toBe('Ñ');
  });

  it('salta lo que no es letra al principio de cada palabra', () => {
    expect(inicialesDe('QA ¿Ana?')).toBe('QA');
    expect(inicialesDe('(Obra) Norte')).toBe('ON');
  });

  it('un teléfono o nada: sin iniciales (va el ícono de persona)', () => {
    expect(inicialesDe('960397018')).toBeNull();
    expect(inicialesDe('+51 960 397 018')).toBeNull();
    expect(inicialesDe('   ')).toBeNull();
  });
});

describe('tonoDeAvatar', () => {
  it('estable: la misma persona, el mismo tono', () => {
    expect(tonoDeAvatar('665f1a2b3c4d5e6f70818293')).toBe(tonoDeAvatar('665f1a2b3c4d5e6f70818293'));
  });

  it('reparte entre los cinco tonos', () => {
    const tonos = new Set(Array.from({ length: 40 }, (_, i) => tonoDeAvatar(`persona-${i}`)));
    expect(tonos.size).toBe(5);
  });
});
