import { describe, expect, it } from 'vitest';
import { resolverUsuarioDeSesion } from './identidadDeSesion.js';

/**
 * El bug de «se me cerró la sesión sola» (28/08/2026).
 *
 * Reproducido de verdad: entrando por el respaldo de correo, la app volvía a la
 * pantalla del número en cada arranque. La causa no estaba en el teléfono ni en
 * el llavero, sino en que el server re-deducía al usuario del texto de identidad
 * que devuelve constroad-auth, y ese texto es el CANAL por el que se canjeó el
 * código — no la llave del usuario.
 */
describe('resolverUsuarioDeSesion', () => {
  /**
   * **El caso que rompía.** Entró por el correo de respaldo, y su usuario no
   * tiene ese correo guardado: la búsqueda por email no encontraba a nadie, el
   * server devolvía 401 y la app —que trata el 401 como revocación— borraba la
   * credencial. Con el registro del dispositivo, ni se mira la identidad.
   */
  it('el registro del dispositivo manda sobre la identidad', () => {
    expect(
      resolverUsuarioDeSesion({
        userIdDelDevice: 'u1',
        identidad: 'jose.test@yopmail.com',
      })
    ).toEqual({ via: 'device', userId: 'u1' });
  });

  it('también manda cuando la identidad es un teléfono', () => {
    expect(
      resolverUsuarioDeSesion({ userIdDelDevice: 'u1', identidad: '902049935' })
    ).toEqual({ via: 'device', userId: 'u1' });
  });

  /**
   * Un dispositivo enrolado por una versión vieja no tiene registro local. No se
   * lo desloguea por eso: se cae al camino anterior, que para él funciona.
   */
  it('sin registro del dispositivo, se deduce por teléfono', () => {
    expect(
      resolverUsuarioDeSesion({ userIdDelDevice: null, identidad: '+51 902 049 935' })
    ).toEqual({ via: 'identidad', porTelefono: '902049935', porEmail: null });
  });

  it('sin registro y con correo, se deduce por correo', () => {
    expect(
      resolverUsuarioDeSesion({ userIdDelDevice: null, identidad: 'Jose@Constroad.com' })
    ).toEqual({ via: 'identidad', porTelefono: null, porEmail: 'jose@constroad.com' });
  });

  /**
   * Si parece celular NO se busca además por correo: un `email` con forma de
   * teléfono no existe, y consultarlo sería una consulta de más en el arranque
   * de cada app.
   */
  it('un teléfono no dispara además la búsqueda por correo', () => {
    const r = resolverUsuarioDeSesion({ userIdDelDevice: null, identidad: '902049935' });

    expect(r).toMatchObject({ porEmail: null });
  });

  it('una identidad vacía no inventa una búsqueda', () => {
    expect(resolverUsuarioDeSesion({ userIdDelDevice: null, identidad: '   ' })).toEqual({
      via: 'identidad',
      porTelefono: null,
      porEmail: null,
    });
  });
});
