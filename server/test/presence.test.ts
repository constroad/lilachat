import { beforeEach, describe, expect, it } from 'vitest';
import { __resetPresence, isOnline, markOffline, markOnline, onlineAmong } from '../src/presence.js';

beforeEach(() => __resetPresence());

describe('presencia', () => {
  it('conectarse pone en línea y avisa el cambio', () => {
    expect(markOnline('u1')).toEqual({ becameOnline: true });
    expect(isOnline('u1')).toBe(true);
  });

  /**
   * Se CUENTAN las conexiones, no se marca un booleano: abrir la app en el
   * teléfono teniendo la web abierta no puede volver a avisar «se conectó» a
   * todos los contactos.
   */
  it('un segundo dispositivo no vuelve a avisar', () => {
    markOnline('u1');
    expect(markOnline('u1')).toEqual({ becameOnline: false });
    expect(isOnline('u1')).toBe(true);
  });

  it('cerrar UN dispositivo teniendo otro abierto no lo pone fuera de línea', () => {
    markOnline('u1');
    markOnline('u1');

    expect(markOffline('u1')).toEqual({ becameOffline: false });
    expect(isOnline('u1')).toBe(true);
  });

  it('cerrar el último sí, y una sola vez', () => {
    markOnline('u1');
    expect(markOffline('u1')).toEqual({ becameOffline: true });
    expect(isOnline('u1')).toBe(false);
  });

  /** Una desconexión duplicada (reconexión sucia) no puede dejar contadores
   *  negativos ni avisar dos veces. */
  it('desconectar de más no rompe el contador', () => {
    markOnline('u1');
    markOffline('u1');

    expect(markOffline('u1')).toEqual({ becameOffline: false });
    expect(isOnline('u1')).toBe(false);
  });

  it('filtra quiénes de una lista están en línea', () => {
    markOnline('u1');
    markOnline('u3');

    expect(onlineAmong(['u1', 'u2', 'u3'])).toEqual(['u1', 'u3']);
  });
});
