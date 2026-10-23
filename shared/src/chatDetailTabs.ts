/**
 * The chat detail grouped like WhatsApp (pending 69, José 22/10; design
 * `r151-detalle-grupo`): identity, actions and description on top, then the
 * tabs. Only a group has members to list. PURE.
 */
export type ChatDetailTab = 'members' | 'media' | 'settings';
export type ChatDetailKind = 'direct' | 'group' | 'notas';

export const CHAT_DETAIL_TAB_LABEL: Record<ChatDetailTab, string> = { members: 'Miembros', media: 'Media', settings: 'Ajustes' };

export function chatDetailTabs(kind: ChatDetailKind): ChatDetailTab[] {
  return kind === 'group' ? ['members', 'media', 'settings'] : ['media', 'settings'];
}

/** The tab the detail opens on: where the chat's ⋮ asked (José, 21/10), else the first one. */
export function initialChatDetailTab(kind: ChatDetailKind, openAt?: 'media' | 'add-members' | null): ChatDetailTab {
  const tabs = chatDetailTabs(kind);
  const asked: ChatDetailTab | null = openAt === 'media' ? 'media' : openAt === 'add-members' ? 'members' : null;
  return asked && tabs.includes(asked) ? asked : (tabs[0] ?? 'media');
}

export function membersHeading(count: number): string {
  return `${count} ${count === 1 ? 'miembro' : 'miembros'}`;
}

/** «Grupo · 5 miembros», under the group's name. */
export function groupSubtitle(count: number): string {
  return `Grupo · ${membersHeading(count)}`;
}
