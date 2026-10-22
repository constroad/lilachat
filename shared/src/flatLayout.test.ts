import { describe, expect, it } from 'vitest';
import { memberBadge, usesFlatLayout } from './flatLayout.js';

/**
 * The Slack format (José, 21/10: «Lilachat se ve muy desordenado»; designs
 * `s-01-grupo-formato-slack` and `s-02-hilo-abierto`): groups and channels as
 * flat rows, 1:1 chats keep their bubbles like WhatsApp.
 */
describe('usesFlatLayout', () => {
  it('a 1:1 or my notes always keep bubbles', () => {
    expect(usesFlatLayout({ kind: 'direct', workspaceId: 'w1' }, { groupsAsList: true })).toBe(false);
    expect(usesFlatLayout({ kind: 'notas' }, { groupsAsList: true })).toBe(false);
  });
  it('a company space is the Slack mode: its groups and channels are always a list', () => {
    expect(usesFlatLayout({ kind: 'group', workspaceId: 'w1' }, { groupsAsList: false })).toBe(true);
    expect(usesFlatLayout({ kind: 'group', channel: { visibility: 'public' } }, { groupsAsList: false })).toBe(true);
  });
  it('a personal group keeps bubbles unless the person asks for the list', () => {
    expect(usesFlatLayout({ kind: 'group' }, { groupsAsList: false })).toBe(false);
    expect(usesFlatLayout({ kind: 'group', workspaceId: null }, { groupsAsList: true })).toBe(true);
  });
});

describe('memberBadge', () => {
  it('an installed app (Lila) says App', () => {
    expect(memberBadge({ role: 'app', isMe: false })).toBe('App');
  });

  it('the job title from the space first, then the role; «Tú» on mine', () => {
    expect(memberBadge({ title: 'Residente de obra', role: 'member', isMe: false })).toBe('Residente de obra');
    expect(memberBadge({ role: 'owner', isMe: true })).toBe('Dueño (Tú)');
    expect(memberBadge({ role: 'admin', isMe: false })).toBe('Admin');
    expect(memberBadge({ title: '  ', role: 'member', isMe: true })).toBe('Tú');
    expect(memberBadge({ role: 'member', isMe: false })).toBeNull();
    expect(memberBadge({ isMe: false })).toBeNull();
  });
});
