import { describe, expect, it } from 'vitest';
import { candidatosParaSumar, spaceMembersAsContacts } from './candidatosParaSumar.js';
import type { ClientWorkspaceMember } from './workspaces.js';
import { groupContactsByLetter, type Contact } from './contacts.js';

const c = (id: string, name: string, phone: string): Contact => ({ id, name, phone });

const wilson = c('u1', 'Wilson', '960397018');
const ana = c('u2', 'Ana', '999111222');
const beto = c('u3', 'Beto', '988777666');

describe('candidatosParaSumar', () => {
  it('saca de la lista a quien ya está en el grupo', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana, beto]),
      yaEstan: ['u1'],
    });

    expect(r.paraSumar.flatMap((g) => g.contacts).map((uno) => uno.id)).toEqual(['u2', 'u3']);
  });

  /**
   * Si al sacar a alguien su letra queda sin nadie, la cabecera se va con él.
   * Una «W» sola sobre la nada se lee como una lista rota.
   */
  it('la letra que queda vacía desaparece', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: ['u1'],
    });

    expect(r.paraSumar.map((g) => g.letter)).toEqual(['A']);
  });

  it('sin nadie adentro devuelve la lista entera', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: [],
    });

    expect(r.paraSumar.flatMap((g) => g.contacts)).toHaveLength(2);
  });

  it('con todos adentro no queda ningún grupo', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: ['u1', 'u2'],
    });

    expect(r.paraSumar).toEqual([]);
  });

  /**
   * **El error que este módulo existe para no cometer.**
   *
   * «A quién falta invitar» se calcula cruzando la agenda del teléfono contra
   * los REGISTRADOS. Si ese cruce recibiera la lista ya recortada, Wilson —que
   * está en Lilachat y además ya está en el grupo— aparecería abajo en «Invitar
   * a Lilachat», ofreciéndole instalar una app que tiene.
   *
   * Por eso las dos listas salen de la misma función: separarlas invita a pasar
   * la recortada al lugar equivocado.
   */
  it('quien ya está en el grupo SIGUE contando como registrado', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: ['u1'],
    });

    expect(r.registrados.map((uno) => uno.id)).toEqual(['u2', 'u1']);
  });

  it('sin registrados todavía, las dos listas son vacías y no null', () => {
    const r = candidatosParaSumar({ registrados: [], yaEstan: ['u1'] });

    expect(r).toEqual({ paraSumar: [], registrados: [] });
  });
});

/**
 * José, 25/10: in the space «Constroad», Juan Carlos made a private channel and
 * «Agregar miembros» did not list Max, a member of the space. The list came from
 * the contacts (a 1:1 already open, or the phone's agenda) and never looked at who
 * is in the space.
 */
describe('spaceMembersAsContacts', () => {
  const member = (userId: string | undefined, name: string | undefined, phone: string | undefined, status: ClientWorkspaceMember['status'] = 'active'): ClientWorkspaceMember => ({
    id: `m-${userId ?? phone}`,
    ...(userId ? { userId } : {}),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    role: 'member',
    status,
  });
  const idsOf = (groups: ReturnType<typeof spaceMembersAsContacts>) => groups.flatMap((group) => group.contacts).map((one) => one.id);

  it('lists the active members by their user id, with no chat open and none in the agenda', () => {
    const groups = spaceMembersAsContacts([member('u-max', 'Max', '987000111'), member('u-ana', 'Ana', '999111222')]);
    expect(idsOf(groups)).toEqual(['u-ana', 'u-max']);
    expect(groups.flatMap((group) => group.contacts)).toContainEqual({ id: 'u-max', name: 'Max', phone: '987000111', directChatId: null });
  });

  it('leaves out who is not in the space yet: pending, invited or deactivated, and an invite with no account', () => {
    const groups = spaceMembersAsContacts([
      member('u-max', 'Max', '987000111'),
      member('u-pend', 'Pendiente', '911000001', 'pending'),
      member(undefined, undefined, '911000002', 'invited'),
      member('u-off', 'Baja', '911000003', 'deactivated'),
    ]);
    expect(idsOf(groups)).toEqual(['u-max']);
  });

  it('a member with no name shows by phone', () => {
    const [group] = spaceMembersAsContacts([member('u-sin', undefined, '987000222')]);
    expect(group?.contacts[0]).toMatchObject({ id: 'u-sin', name: null, phone: '987000222' });
  });

  it('the ones already in the channel do not show, and an empty letter goes with them', () => {
    const groups = spaceMembersAsContacts([member('u-jc', 'Juan Carlos', '987000333'), member('u-max', 'Max', '987000111')]);
    const { paraSumar } = candidatosParaSumar({ registrados: groups, yaEstan: ['u-jc'] });
    expect(paraSumar.map((group) => group.letter)).toEqual(['M']);
    expect(idsOf(paraSumar)).toEqual(['u-max']);
  });
});
