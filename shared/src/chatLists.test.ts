import { describe, expect, it } from 'vitest';
import { CHAT_LIST_CHATS_MAX, changeListChats, chatListNameError, diffListChats, listFilter, listIdOf, listMembership, listsWithChat, type ChatList } from './chatLists.js';

const family: ChatList = { id: '6ad9a0000000000000000001', name: 'Familia', chatIds: ['c1', 'c2'] };
const friends: ChatList = { id: '6ad9a0000000000000000002', name: 'Amigos', chatIds: ['c2'] };

describe('chatListNameError', () => {
  it('a new name is fine', () => {
    // Arrange / Act
    const error = chatListNameError('Obra Miraflores', [family, friends]);
    // Assert
    expect(error).toBeNull();
  });

  it('an empty name asks for one', () => {
    expect(chatListNameError('   ', [])).toBe('Escribe un nombre para la lista.');
  });

  it('a name longer than 24 letters is refused', () => {
    expect(chatListNameError('x'.repeat(25), [])).toBe('El nombre puede tener hasta 24 letras.');
  });

  it('the same name as another list, in any case or accent, is refused', () => {
    expect(chatListNameError('familia', [family])).toBe('Ya tienes una lista con ese nombre.');
    expect(chatListNameError('AMIGÓS', [friends])).toBe('Ya tienes una lista con ese nombre.');
  });

  it('renaming a list to its own name is fine', () => {
    expect(chatListNameError('Familia', [family], family.id)).toBeNull();
  });

  it('the names of the fixed chips are taken', () => {
    expect(chatListNameError('No leidos', [])).toBe('Ese nombre ya es un filtro de la lista.');
    expect(chatListNameError('borradores', [])).toBe('Ese nombre ya es un filtro de la lista.');
  });
});

describe('changeListChats', () => {
  it('adds at the end, without repeating, and removes', () => {
    expect(changeListChats(['c1', 'c2'], { add: ['c3', 'c1'], remove: ['c2'] })).toEqual(['c1', 'c3']);
  });

  it('nothing to change keeps the same chats', () => {
    expect(changeListChats(['c1'], {})).toEqual(['c1']);
  });

  it('never passes the most chats a list can hold', () => {
    const full = Array.from({ length: CHAT_LIST_CHATS_MAX }, (_, index) => `c${index}`);
    expect(changeListChats(full, { add: ['extra'] })).toHaveLength(CHAT_LIST_CHATS_MAX);
  });
});

describe('list filters', () => {
  it('a list chip filters by its id and reads it back', () => {
    expect(listIdOf(listFilter(family.id))).toBe(family.id);
  });

  it('the fixed chips are not a list', () => {
    expect(listIdOf('todos')).toBeNull();
    expect(listIdOf('grupos')).toBeNull();
  });

  it('the lists a chat is in', () => {
    expect(listsWithChat([family, friends], 'c2').map((list) => list.name)).toEqual(['Familia', 'Amigos']);
    expect(listsWithChat([family, friends], 'c9')).toEqual([]);
  });
});

describe('diffListChats', () => {
  it('what was ticked and unticked in the editor', () => {
    expect(diffListChats(['c1', 'c2'], ['c2', 'c3'])).toEqual({ add: ['c3'], remove: ['c1'] });
  });

  it('nothing changed', () => {
    expect(diffListChats(['c1'], ['c1'])).toEqual({ add: [], remove: [] });
  });
});

describe('listMembership', () => {
  it('all, some or none of the chosen chats are in the list', () => {
    expect(listMembership(family, ['c1', 'c2'])).toBe('all');
    expect(listMembership(family, ['c1', 'c9'])).toBe('some');
    expect(listMembership(family, ['c9'])).toBe('none');
  });
});
