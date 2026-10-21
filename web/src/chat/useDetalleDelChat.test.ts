import { describe, expect, it } from 'vitest';
import { aDetalle, detailWithAgenda } from './useDetalleDelChat';

describe('aDetalle', () => {
  it('resuelve el nombre: yo soy «Tú», sin nombre va el teléfono, sin nada «Alguien»', () => {
    const detalle = aDetalle({
      members: [
        { id: 'u1', name: 'José', phone: '9', esYo: true, role: 'admin' },
        { id: 'u2', name: null, phone: '960397018' },
        { id: 'u3', name: null, phone: null },
      ],
    });

    expect([...detalle.miembros.values()].map((m) => m.nombre)).toEqual(['Tú', '960397018', 'Alguien']);
    expect(detalle.soyAdmin).toBe(true);
  });

  it('sin ser admin, no lo es', () => {
    expect(aDetalle({ members: [{ id: 'u1', name: 'José', phone: '9', esYo: true }] }).soyAdmin).toBe(false);
  });

  it('trae la descripción del grupo (20/10)', () => {
    expect(aDetalle({ descripcion: 'Reglas:\n1) Fotos', members: [{ id: 'u1', name: 'José', phone: '9', esYo: true }] }).descripcion).toBe('Reglas:\n1) Fotos');
  });
});

/** Members with the name saved in the phone (20/10, option «b»). */
describe('detailWithAgenda', () => {
  it('a member takes the saved name; I stay «Tú»; without changes it is the same object', () => {
    const detalle = aDetalle({
      members: [
        { id: 'u1', name: 'José', phone: '902049935', esYo: true },
        { id: 'u2', name: null, phone: '960397018' },
      ],
    });
    const agenda = new Map([['960397018', 'Wilson'], ['902049935', 'Yo mismo']]);
    const named = detailWithAgenda(detalle, agenda);
    expect(named.miembros.get('u2')?.nombre).toBe('Wilson');
    expect(named.miembros.get('u1')?.nombre).toBe('Tú');
    expect(detailWithAgenda(detalle, new Map())).toBe(detalle);
  });
});
