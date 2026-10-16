import { describe, expect, it } from 'vitest';
import { nombresPorMiembro } from './nombresDelGrupo';

describe('nombresPorMiembro', () => {
  it('gana el nombre de la agenda del teléfono', () => {
    const agenda = new Map([['960397018', 'Wilson']]);

    const nombres = nombresPorMiembro([{ id: 'u1', name: 'W. Pérez', phone: '960397018' }], agenda);

    expect(nombres.get('u1')).toBe('Wilson');
  });

  it('sin agenda, el nombre de Lilachat', () => {
    expect(nombresPorMiembro([{ id: 'u2', name: 'Mamá', phone: '900000002' }], new Map()).get('u2')).toBe('Mamá');
  });

  it('sin nombre en ningún lado, algo legible y nunca vacío', () => {
    const nombre = nombresPorMiembro([{ id: 'u3', name: null, phone: null }], new Map()).get('u3');
    expect(nombre).toBeTruthy();
  });
});
