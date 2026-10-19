import { describe, expect, it } from 'vitest';
import { fotosPorMiembro, membresiaPorRespuesta, nombresPorMiembro } from './nombresDelGrupo';

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

/** La foto de cada autor en las burbujas del grupo (FL13d), como el diseño. */
describe('fotosPorMiembro', () => {
  it('solo los que tienen foto', () => {
    const fotos = fotosPorMiembro([
      { id: 'u1', name: 'Ana', phone: '900000001', avatarUrl: 'https://x/ana.jpg' },
      { id: 'u2', name: 'Beto', phone: '900000002' },
      { id: 'u3', name: 'Carla', phone: '900000003', avatarUrl: '' },
    ]);

    expect([...fotos.entries()]).toEqual([['u1', 'https://x/ana.jpg']]);
  });
});

/**
 * ¿Sigo en el grupo? (FL9d; auditoría §46.2: sacado del grupo, la conversación
 * seguía con la barra de escribir). Solo un «no» del server dice que no: sin
 * red o con un error se sigue como estaba —el gate degrada sin señal—.
 */
describe('membresiaPorRespuesta', () => {
  it('200 sí; 403 y 404 no', () => {
    expect(membresiaPorRespuesta(200)).toBe(true);
    expect(membresiaPorRespuesta(404)).toBe(false);
    expect(membresiaPorRespuesta(403)).toBe(false);
  });

  it('sin red o con un error del server: no se sabe', () => {
    expect(membresiaPorRespuesta('sin-red')).toBeNull();
    expect(membresiaPorRespuesta(500)).toBeNull();
    expect(membresiaPorRespuesta(401)).toBeNull();
  });
});
