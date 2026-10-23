import { describe, expect, it } from 'vitest';
import { CHAT_DETAIL_TAB_LABEL, chatDetailTabs, groupSubtitle, initialChatDetailTab, membersHeading } from './chatDetailTabs.js';

describe('chat detail tabs (pending 69)', () => {
  it('a group has Miembros · Media · Ajustes, in that order', () => {
    expect(chatDetailTabs('group').map((tab) => CHAT_DETAIL_TAB_LABEL[tab])).toEqual(['Miembros', 'Media', 'Ajustes']);
  });

  it('a 1:1 and a draft have no members to list', () => {
    expect(chatDetailTabs('direct')).toEqual(['media', 'settings']);
    expect(chatDetailTabs('notas')).toEqual(['media', 'settings']);
  });

  it('opens on the first tab, or where the ⋮ asked', () => {
    expect(initialChatDetailTab('group')).toBe('members');
    expect(initialChatDetailTab('direct', null)).toBe('media');
    expect(initialChatDetailTab('group', 'media')).toBe('media');
    expect(initialChatDetailTab('group', 'add-members')).toBe('members');
  });

  it('«add members» on a chat without members falls back to the first tab', () => {
    expect(initialChatDetailTab('direct', 'add-members')).toBe('media');
  });

  it('says «miembro» in singular only for one', () => {
    expect(groupSubtitle(5)).toBe('Grupo · 5 miembros');
    expect(groupSubtitle(1)).toBe('Grupo · 1 miembro');
    expect(membersHeading(5)).toBe('5 miembros');
    expect(membersHeading(1)).toBe('1 miembro');
  });
});
