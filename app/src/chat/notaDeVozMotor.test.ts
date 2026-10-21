import { describe, expect, it } from 'vitest';
import { tomarElAudio, __soltarAudio } from './notaDeVozMotor';

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
