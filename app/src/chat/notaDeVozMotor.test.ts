import { describe, expect, it } from 'vitest';
import { tomarElAudio, __soltarAudio, showsSpeed, knobLeft } from './notaDeVozMotor';

/** Notas de voz como WhatsApp (FL9b; auditoría §46.2). */
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

/** José, 21/10: the voice note like WhatsApp's. */
describe('voice note like WhatsApp', () => {
  it('the speed takes the photo\'s place while it plays or is paused midway', () => {
    expect(showsSpeed(true, 0)).toBe(true);
    expect(showsSpeed(false, 0.4)).toBe(true);
    expect(showsSpeed(false, 0)).toBe(false);
    expect(showsSpeed(false, 1)).toBe(false);
  });

  it('the knob stays inside the bar at both ends', () => {
    expect(knobLeft(0, 200, 12)).toBe(0);
    expect(knobLeft(0.5, 200, 12)).toBe(94);
    expect(knobLeft(1, 200, 12)).toBe(188);
    expect(knobLeft(2, 200, 12)).toBe(188);
  });
});
