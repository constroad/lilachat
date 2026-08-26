import { describe, expect, it } from 'vitest';
import { separarAgenda } from './agendaLocal.js';

/**
 * Cruzar la agenda del teléfono contra quién ya está en Lilachat.
 *
 * **El cruce se hace EN EL TELÉFONO.** Es la diferencia que importa: WhatsApp
 * sube tu libreta entera a sus servidores para hacer esto; acá el server ya nos
 * dijo quiénes son nuestros contactos registrados —gente con la que podemos
 * hablar de todos modos— y la agenda se compara contra esa lista sin salir del
 * aparato. Nunca viaja un número que el server no conociera ya.
 *
 * Es lo que permite la pantalla que pidió José: los que ya están, arriba; los
 * que hay que invitar, abajo. Como WhatsApp, sin el costo de WhatsApp.
 */
const registrado = (phone: string, name?: string) => ({ id: `u-${phone}`, phone, name: name ?? null });
const enAgenda = (telefono: string, nombre: string) => ({ id: `c-${telefono}`, telefono, nombre });

describe('separarAgenda', () => {
  it('quien está registrado no aparece para invitar', () => {
    const salida = separarAgenda({
      registrados: [registrado('999111222', 'Mamá')],
      agenda: [enAgenda('999111222', 'Mamá casa')],
    });

    expect(salida.paraInvitar).toEqual([]);
    expect(salida.enLilachat).toHaveLength(1);
  });

  /**
   * El mismo número escrito distinto es la MISMA persona. Es el caso normal,
   * no el raro: la agenda tiene «+51 999 111 222» y el server «999111222».
   * Sin normalizar, todos los contactos aparecerían como «para invitar» y la
   * pantalla sería inútil.
   */
  it('el formato no cambia quién es quién', () => {
    const salida = separarAgenda({
      registrados: [registrado('999111222')],
      agenda: [enAgenda('+51 999 111 222', 'Mamá')],
    });

    expect(salida.paraInvitar).toEqual([]);
  });

  it('quien no está, va a invitar', () => {
    const salida = separarAgenda({
      registrados: [registrado('999111222')],
      agenda: [enAgenda('988777666', 'Tía')],
    });

    expect(salida.paraInvitar.map((uno) => uno.nombre)).toEqual(['Tía']);
  });

  /**
   * La agenda repite: el mismo número como «casa» y como «celular». Se invita
   * UNA vez — mandar dos mensajes iguales a la misma persona es lo que hace que
   * una invitación parezca spam.
   */
  it('un número repetido se invita una sola vez', () => {
    const salida = separarAgenda({
      registrados: [],
      agenda: [enAgenda('988777666', 'Tía casa'), enAgenda('+51988777666', 'Tía cel')],
    });

    expect(salida.paraInvitar).toHaveLength(1);
  });

  /** Sin número no se puede invitar a nadie. */
  it('un contacto sin número no entra', () => {
    const salida = separarAgenda({ registrados: [], agenda: [enAgenda('', 'Sin número')] });

    expect(salida.paraInvitar).toEqual([]);
  });

  it('ordena por nombre, que es como se busca', () => {
    const salida = separarAgenda({
      registrados: [],
      agenda: [enAgenda('988000001', 'Zoe'), enAgenda('988000002', 'Ana')],
    });

    expect(salida.paraInvitar.map((uno) => uno.nombre)).toEqual(['Ana', 'Zoe']);
  });

  /** Sin agenda —permiso denegado— igual se listan los registrados. */
  it('sin agenda, los registrados siguen ahí', () => {
    const salida = separarAgenda({ registrados: [registrado('999111222')], agenda: [] });

    expect(salida.enLilachat).toHaveLength(1);
    expect(salida.paraInvitar).toEqual([]);
  });
});
