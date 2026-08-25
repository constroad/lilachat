import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveJwtSecret, signSession, verifySession } from './sessions.js';

/**
 * El secreto de las sesiones.
 *
 * Este archivo nació VACÍO por un heredoc suelto y tumbó el CI con «No test
 * suite found» — un archivo de test sin tests es un fallo, no un archivo de
 * más. Se llena en vez de borrarse porque lo que hay adentro es justo lo que
 * casi rompe producción: sin `JWT_SECRET`, el server arrancaba sano y rechazaba
 * a TODO el mundo sin una línea en el log.
 */
const original = { ...process.env };

beforeEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...original };
});

describe('resolveJwtSecret', () => {
  it('usa el secreto del entorno cuando está', () => {
    process.env.JWT_SECRET = 'un-secreto-de-verdad';

    expect(resolveJwtSecret()).toBe('un-secreto-de-verdad');
  });

  /**
   * En desarrollo hay un secreto de reemplazo para no obligar a configurar
   * nada antes de correr `npm run dev`.
   */
  it('fuera de producción cae a un secreto de desarrollo', () => {
    expect(resolveJwtSecret()).toMatch(/dev/);
  });

  /**
   * En producción, NO. Un secreto de desarrollo en producción significa que
   * cualquiera que lea el repo puede firmarse una sesión de quien quiera.
   */
  it('en producción sin secreto, falla', () => {
    process.env.NODE_ENV = 'production';

    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });
});

describe('signSession / verifySession', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
  });

  it('lo que se firma se puede leer de vuelta', () => {
    const token = signSession({ userId: 'u1', deviceId: 'd1', email: '902049935' });

    expect(verifySession(token)).toMatchObject({
      userId: 'u1',
      deviceId: 'd1',
      email: '902049935',
    });
  });

  /**
   * Un token alterado se RECHAZA, y devolviendo `null` en vez de lanzar: el
   * guard de las rutas lo trata como «sin sesión», que es exactamente lo que
   * es. Si lanzara, cada request con un token viejo sería un 500.
   */
  it('un token manipulado no pasa', () => {
    const token = signSession({ userId: 'u1', deviceId: 'd1', email: 'x' });
    const alterado = `${token.slice(0, -3)}AAA`;

    expect(verifySession(alterado)).toBeNull();
  });

  it('basura tampoco', () => {
    expect(verifySession('esto-no-es-un-jwt')).toBeNull();
    expect(verifySession('')).toBeNull();
  });

  /**
   * Firmado con OTRO secreto no vale. Es lo que separa a un server de otro —y
   * lo que hizo que un script mío firmara tokens que el server rechazaba,
   * porque no había cargado el `.env`.
   */
  it('firmado con otro secreto, no vale', () => {
    const token = signSession({ userId: 'u1', deviceId: 'd1', email: 'x' });
    process.env.JWT_SECRET = 'otro-secreto-distinto';

    expect(verifySession(token)).toBeNull();
  });
});
