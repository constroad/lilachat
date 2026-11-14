import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '../../api/client';
import { knownChatsView, mergeKnownChats } from './knownChatsView';

const chat = (id: string): ChatSummary => ({ id }) as ChatSummary;
const NOTHING_YET = { active: true, ownChats: null, ownChatsSettled: false, spaceKey: null, spacePage: { loading: false } };

/**
 * José 14/11: «Compartir en» from Android's share sheet listed only «Tú» and
 * the other chats never came. The personal list was read once, when the
 * screen opened; on a cold start (Samsung kills the app) it was still not in
 * memory, and nothing read it again.
 */
describe('knownChatsView', () => {
  it('opened before the personal list is known: loading, not an empty list', () => {
    // Arrange
    const input = NOTHING_YET;
    // Act
    const view = knownChatsView(input);
    // Assert
    expect(view).toEqual({ chats: [], loading: true });
  });

  it('the personal list arrives later: its chats show and loading ends', () => {
    // Arrange
    const input = { ...NOTHING_YET, ownChats: [chat('a'), chat('b')] };
    // Act
    const view = knownChatsView(input);
    // Assert
    expect(view).toEqual({ chats: [chat('a'), chat('b')], loading: false });
  });

  it('no list on the phone and no network: it stops loading once the attempt settled', () => {
    expect(knownChatsView({ ...NOTHING_YET, ownChatsSettled: true })).toEqual({ chats: [], loading: false });
  });

  it('in a space whose list has not come: still loading, with the personal chats already shown', () => {
    // Arrange
    const input = { ...NOTHING_YET, ownChats: [chat('p')], spaceKey: 's1:chats', spacePage: { loading: true } };
    // Act
    const view = knownChatsView(input);
    // Assert
    expect(view).toEqual({ chats: [chat('p')], loading: true });
  });

  it('the space list failed: what there is shows, without loading forever', () => {
    const input = { ...NOTHING_YET, ownChats: [chat('p')], spaceKey: 's1:chats', spacePage: { loading: false, error: 'sin red' } };
    expect(knownChatsView(input)).toEqual({ chats: [chat('p')], loading: false });
  });

  it('the space first, then the personal ones it does not repeat', () => {
    const input = { ...NOTHING_YET, ownChats: [chat('x'), chat('p')], spaceKey: 's1:chats', spacePage: { loading: false, value: { chats: [chat('x'), chat('c')] } } };
    expect(knownChatsView(input).chats.map((one) => one.id)).toEqual(['x', 'c', 'p']);
  });

  it('closed: nothing and not loading', () => {
    expect(knownChatsView({ ...NOTHING_YET, active: false, ownChats: [chat('a')] })).toEqual({ chats: [], loading: false });
  });
});

describe('mergeKnownChats', () => {
  it('keeps the space order and drops personal repeats', () => {
    expect(mergeKnownChats([chat('a')], [chat('a'), chat('b')]).map((one) => one.id)).toEqual(['a', 'b']);
  });
});
