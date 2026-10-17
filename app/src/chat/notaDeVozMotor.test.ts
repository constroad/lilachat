import { describe, expect, it } from 'vitest';
import { segundosDelToque, siguienteVelocidad, tomarElAudio, __soltarAudio } from './notaDeVozMotor';

/** Notas de voz como WhatsApp (FL9b; auditoría §46.2). */
describe('siguienteVelocidad', () => {
  it('1× → 1,5× → 2× → 1×', () => {
    expect(siguienteVelocidad(1)).toBe(1.5);
    expect(siguienteVelocidad(1.5)).toBe(2);
    expect(siguienteVelocidad(2)).toBe(1);
  });

  it('un valor raro vuelve a 1×', () => {
    expect(siguienteVelocidad(3)).toBe(1);
  });
});

describe('segundosDelToque', () => {
  it('tocar la mitad de la barra va a la mitad del audio', () => {
    expect(segundosDelToque({ x: 50, ancho: 100, duracion: 30 })).toBe(15);
  });

  it('fuera de la barra se acota; sin duración, 0', () => {
    expect(segundosDelToque({ x: -10, ancho: 100, duracion: 30 })).toBe(0);
    expect(segundosDelToque({ x: 150, ancho: 100, duracion: 30 })).toBe(30);
    expect(segundosDelToque({ x: 50, ancho: 0, duracion: 30 })).toBe(0);
    expect(segundosDelToque({ x: 50, ancho: 100, duracion: 0 })).toBe(0);
  });
});

describe('tomarElAudio', () => {
  // Dos notas a la vez se pisaban (auditoría §46.2): al darle play a una, la
  // que sonaba se pausa.
  it('al darle play a otra, la que sonaba se pausa', () => {
    __soltarAudio();
    const pausadas: string[] = [];
    tomarElAudio('a', () => pausadas.push('a'));
    tomarElAudio('b', () => pausadas.push('b'));

    expect(pausadas).toEqual(['a']);
  });

  it('la misma nota no se pausa a sí misma', () => {
    __soltarAudio();
    const pausadas: string[] = [];
    tomarElAudio('a', () => pausadas.push('a'));
    tomarElAudio('a', () => pausadas.push('a'));

    expect(pausadas).toEqual([]);
  });
});
