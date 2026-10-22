/**
 * The Slack format (José, 21/10; designs `s-01-grupo-formato-slack` and
 * `s-02-hilo-abierto`): a group or channel reads as flat rows (avatar, name,
 * role, time, then the text) instead of bubbles. A company space is the Slack
 * mode, so its groups and channels always go that way; a personal group keeps
 * WhatsApp's bubbles unless the person asks for the list; a 1:1 is always a
 * conversation of bubbles. PURE: the app and the web decide the same.
 */
export type FlatLayoutChat = { kind: 'direct' | 'group' | 'notas'; workspaceId?: string | null; channel?: unknown };

export function usesFlatLayout(chat: FlatLayoutChat, prefs: { groupsAsList: boolean }): boolean {
  if (chat.kind !== 'group') return false;
  return Boolean(chat.workspaceId || chat.channel) || prefs.groupsAsList;
}

const ROLE_LABEL: Record<string, string> = { owner: 'Dueño', admin: 'Admin' };

/** What a member's pill is made of: the role (in a space, the space's) and the job title in the space. */
export type MemberPill = { role?: string | null; title?: string | null };

/** The pill next to a name: the job title from the space, or the role; mine says «Tú» too. */
export function memberBadge(params: { title?: string | null; role?: string | null; isMe: boolean }): string | null {
  const label = params.title?.trim() || (params.role ? ROLE_LABEL[params.role] : undefined);
  if (label) return params.isMe ? `${label} (Tú)` : label;
  return params.isMe ? 'Tú' : null;
}
