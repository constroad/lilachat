import { describe, expect, it } from 'vitest';
import { nivelEnDb, tipoDeGrabacion } from './nivelDeAudio';

describe('nivelEnDb', () => {
  it('silencio total es el piso, no -Infinity', () => {
    expect(nivelEnDb(new Float32Array(8))).toBe(-100);
  });

  it('una onda a tope ronda 0 dB', () => {
    expect(nivelEnDb(Float32Array.from([1, -1, 1, -1]))).toBeCloseTo(0, 5);
  });

  it('a la mitad, unos -6 dB', () => {
    expect(nivelEnDb(Float32Array.from([0.5, -0.5]))).toBeCloseTo(-6.02, 1);
  });
});

describe('tipoDeGrabacion', () => {
  it('prefiere webm con opus (Chrome, Firefox, Android la reproduce)', () => {
    expect(tipoDeGrabacion((tipo) => tipo === 'audio/webm;codecs=opus' || tipo === 'audio/mp4')).toBe('audio/webm;codecs=opus');
  });

  it('sin webm (Safari), mp4', () => {
    expect(tipoDeGrabacion((tipo) => tipo === 'audio/mp4')).toBe('audio/mp4');
  });

  it('sin nada conocido, que decida el navegador', () => {
    expect(tipoDeGrabacion(() => false)).toBe('');
  });
});
