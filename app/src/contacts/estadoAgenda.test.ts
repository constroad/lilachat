import { describe, expect, it } from 'vitest';
import { resolverEstadoAgenda } from './estadoAgenda';

/**
 * Los cuatro estados de leer la agenda — y sobre todo el que faltaba.
 *
 * El 26/08/2026 la pantalla «Invitar» se quedó con los esqueletos para SIEMPRE.
 * La causa fue una llamada a una API que en `expo-contacts` 57 ya no existe en
 * la raíz (`getContactsAsync` y `Fields` viven en `expo-contacts/legacy`), así
 * que la promesa se rechazaba… y como «cargando» era la ausencia de datos, un
 * fallo se veía **exactamente igual** que una carga lenta.
 *
 * De ahí la regla: **el error es un estado propio**, no la falta de los otros.
 * Mientras «cargando» sea «todavía no llegó nada», todo lo que salga mal se va a
 * ver como si estuviera por llegar.
 */
describe('resolverEstadoAgenda', () => {
  it('mientras no hay respuesta, carga', () => {
    expect(resolverEstadoAgenda({ permiso: null, agenda: null, fallo: null }).estado).toBe(
      'cargando'
    );
  });

  it('permiso denegado se dice, no se disfraza de vacío', () => {
    expect(resolverEstadoAgenda({ permiso: 'denegado', agenda: null, fallo: null }).estado).toBe(
      'denegado'
    );
  });

  /** LO QUE FALTABA: un fallo tiene su propio estado y su propio mensaje. */
  it('un fallo al leer la agenda es un ERROR, no una carga eterna', () => {
    const salida = resolverEstadoAgenda({
      permiso: 'concedido',
      agenda: null,
      fallo: 'Cannot read property PhoneNumbers of undefined',
    });

    expect(salida.estado).toBe('error');
    expect(salida.estado === 'error' && salida.mensaje).toContain('PhoneNumbers');
  });

  /** El fallo gana sobre la carga: si ya se sabe que se rompió, no se espera más. */
  it('con fallo no se sigue mostrando el esqueleto', () => {
    expect(
      resolverEstadoAgenda({ permiso: 'concedido', agenda: null, fallo: 'boom' }).estado
    ).not.toBe('cargando');
  });

  it('con la agenda leída, listo', () => {
    const salida = resolverEstadoAgenda({ permiso: 'concedido', agenda: [], fallo: null });
    expect(salida.estado).toBe('listo');
  });

  /**
   * Una agenda vacía de verdad es «listo» con cero, no un error: hay teléfonos
   * sin ningún contacto y eso no está roto.
   */
  it('una agenda vacía es un resultado, no un fallo', () => {
    const salida = resolverEstadoAgenda({ permiso: 'concedido', agenda: [], fallo: null });
    expect(salida.estado === 'listo' && salida.agenda).toEqual([]);
  });
});
