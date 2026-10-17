import { describe, expect, it } from 'vitest';
import { leerPerfil, perfilVisible } from './perfilVisible';

const YO = '665f1a2b3c4d5e6f70818293';

/** El perfil propio (FL9): lo que contesta el server y lo que se muestra. */
describe('leerPerfil', () => {
  it('toma nombre, teléfono y foto del payload', () => {
    expect(leerPerfil({ name: 'José', phone: '902049935', avatarUrl: 'https://x/y.jpg' })).toEqual({
      name: 'José',
      phone: '902049935',
      avatarUrl: 'https://x/y.jpg',
    });
  });

  it('sin foto ni nombre: null en los dos', () => {
    expect(leerPerfil({ phone: '902049935' })).toEqual({ name: null, phone: '902049935', avatarUrl: null });
  });

  it('un payload sin teléfono no es un perfil', () => {
    expect(leerPerfil({ name: 'x' })).toBeNull();
    expect(leerPerfil(undefined)).toBeNull();
  });
});

describe('perfilVisible', () => {
  const credencial = { userId: YO, name: 'Viejo', avatarUrl: null };

  it('sin cambios en esta sesión manda la credencial', () => {
    expect(perfilVisible(credencial, null)).toEqual({ name: 'Viejo', avatarUrl: null });
  });

  it('lo cambiado en esta sesión gana', () => {
    expect(perfilVisible(credencial, { userId: YO, name: 'Nuevo', avatarUrl: 'https://x/y.jpg' })).toEqual({
      name: 'Nuevo',
      avatarUrl: 'https://x/y.jpg',
    });
  });

  it('lo cambiado por OTRA cuenta en este teléfono no se hereda', () => {
    expect(perfilVisible(credencial, { userId: 'otro', name: 'Ajeno', avatarUrl: null })).toEqual({
      name: 'Viejo',
      avatarUrl: null,
    });
  });
});
