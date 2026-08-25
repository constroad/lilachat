import { describe, expect, it } from 'vitest';
import { planTargetChat } from './agenda.js';

/**
 * Dónde vive un evento o una encuesta.
 *
 * Un evento SIEMPRE cuelga de una conversación —el server saca de ahí a los
 * invitados, así nadie invita a alguien ajeno al chat—, pero a la persona no se
 * le pregunta por conversaciones: elige CONTACTOS, como en cualquier agenda. La
 * traducción de una cosa a la otra es esta función.
 *
 * Vive en `shared` porque la app y la web tienen que decidir IGUAL. Estaba
 * escrita dentro de la pantalla de la app, y la web —que nació sin estas
 * pantallas— la habría vuelto a escribir con otro criterio: dos clientes
 * creando grupos distintos con los mismos contactos.
 */
describe('planTargetChat', () => {
  it('creado desde adentro de un chat, se queda en ese chat', () => {
    expect(
      planTargetChat({ fixedChatId: 'c1', inviteeIds: ['u2', 'u3'], groupName: 'Asado' })
    ).toEqual({ kind: 'existing', chatId: 'c1' });
  });

  /**
   * Con UNA persona es el chat 1:1 de siempre. Crear un grupo de dos con el
   * nombre del evento partiría la conversación con esa persona en dos hilos.
   */
  it('un solo invitado va al chat directo, sin nombre', () => {
    expect(planTargetChat({ inviteeIds: ['u2'], groupName: 'Asado' })).toEqual({
      kind: 'create',
      chat: { kind: 'direct', memberIds: ['u2'] },
    });
  });

  it('varios invitados arman un grupo con el nombre del evento', () => {
    expect(planTargetChat({ inviteeIds: ['u2', 'u3'], groupName: '  Asado  ' })).toEqual({
      kind: 'create',
      chat: { kind: 'group', memberIds: ['u2', 'u3'], name: 'Asado' },
    });
  });

  /**
   * El mismo contacto tocado dos veces no puede sumar un miembro: el server
   * cuenta miembros para decidir si un 1:1 ya existe, y un duplicado convertiría
   * un directo en un grupo fantasma de dos.
   */
  it('el mismo contacto repetido cuenta una vez', () => {
    expect(planTargetChat({ inviteeIds: ['u2', 'u2'], groupName: 'Asado' })).toEqual({
      kind: 'create',
      chat: { kind: 'direct', memberIds: ['u2'] },
    });
  });

  it('sin invitados no hay dónde ponerlo', () => {
    expect(planTargetChat({ inviteeIds: [], groupName: 'Asado' })).toEqual({
      kind: 'invalid',
      message: 'Elige a quién invitar.',
    });
  });

  /**
   * El grupo hereda el nombre del evento, así que un evento sin título dejaría
   * un grupo sin nombre —que el server rechaza con un 400 después de haber
   * llenado todo el formulario—. Se corta acá.
   */
  it('un grupo sin nombre no se crea', () => {
    expect(planTargetChat({ inviteeIds: ['u2', 'u3'], groupName: '   ' })).toEqual({
      kind: 'invalid',
      message: 'Ponle un nombre.',
    });
  });

  /** Un chat fijo vacío es «no hay chat», no un chat llamado «». */
  it('un chat fijo en blanco se ignora', () => {
    expect(planTargetChat({ fixedChatId: '  ', inviteeIds: ['u2'], groupName: 'Asado' })).toEqual({
      kind: 'create',
      chat: { kind: 'direct', memberIds: ['u2'] },
    });
  });
});
