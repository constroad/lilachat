import { describe, expect, it } from 'vitest';
import type { Credential } from './credentialStore';
import { conCredencialNueva, entraSinEsperar } from './arranque';

const credencial = (cambios: Partial<Credential> = {}): Credential => ({
  userId: '665f1a2b3c4d5e6f70818293',
  deviceId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
  deviceSecret: 'secreto-del-device',
  jwt: 'jwt-viejo',
  phone: '902049935',
  name: 'José',
  ...cambios,
});

/**
 * El arranque pinta lo guardado sin esperar a la red. Antes esperaba
 * `refreshSession` —hasta 15 s con mala señal— con un spinner en pantalla:
 * WhatsApp abre al instante desde el disco.
 */
describe('entraSinEsperar', () => {
  it('con una credencial completa se entra ya', () => {
    expect(entraSinEsperar(credencial())).toBe(true);
  });

  /** Una versión vieja guardaba sin `userId`: sin él todo se ve como recibido. */
  it('sin userId hay que esperar al refresh, que lo repara', () => {
    expect(entraSinEsperar(credencial({ userId: '' }))).toBe(false);
  });
});

describe('conCredencialNueva', () => {
  it('en la lista, cambia la credencial y sigue en la lista', () => {
    const nueva = credencial({ jwt: 'jwt-nuevo' });

    expect(conCredencialNueva({ phase: 'home', credential: credencial() }, nueva)).toEqual({
      phase: 'home',
      credential: nueva,
    });
  });

  /** El refresh puede llegar con un chat ya abierto: no lo saca de ahí. */
  it('con un chat abierto, lo conserva', () => {
    const chat = { id: '6a90cf9012ab34cd56ef7890' };
    const nueva = credencial({ jwt: 'jwt-nuevo' });

    expect(conCredencialNueva({ phase: 'chat', credential: credencial(), chat }, nueva)).toEqual({
      phase: 'chat',
      credential: nueva,
      chat,
    });
  });

  it('fuera de la sesión (alta, código) no hace nada', () => {
    const estado = { phase: 'email' as const };

    expect(conCredencialNueva(estado, credencial())).toBe(estado);
  });
});
