import { describe, expect, it } from 'vitest';
import { puedeProgramar } from './scheduledMessages.js';

const ahora = new Date('2026-01-01T12:00:00Z');
const enMs = (ms: number) => new Date(ahora.getTime() + ms);

describe('puedeProgramar', () => {
  it('a futuro (más de 30s) se puede', () => {
    expect(puedeProgramar(enMs(3_600_000), ahora)).toBe(true);
  });

  it('en el pasado no: sería un mensaje normal, no uno programado', () => {
    expect(puedeProgramar(enMs(-1_000), ahora)).toBe(false);
  });

  it('demasiado cerca (10s) no: es «enviar ahora» disfrazado', () => {
    expect(puedeProgramar(enMs(10_000), ahora)).toBe(false);
  });

  it('más de un año no: llenaría la base con algo que nadie va a ver', () => {
    expect(puedeProgramar(enMs(400 * 24 * 3_600_000), ahora)).toBe(false);
  });
});
