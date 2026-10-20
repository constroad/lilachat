import { describe, expect, it } from 'vitest';
import { aDetalle } from './useDetalleDelChat';

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
