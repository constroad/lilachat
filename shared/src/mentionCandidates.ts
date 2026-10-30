import type { WorkspaceMemberStatus } from './workspaces.js';
import { rangosDeMenciones, type MencionElegida } from './textoDelComposer.js';
import { compareNamesLoose } from './compareText.js';

/** A person the composer offers after «@»: of the chat, or of its space but not in the chat yet (Slack). */
export type MentionCandidate = { id: string; nombre: string; foto?: string; outsideChat?: boolean };

/** The few fields of a space member the mention list reads (a `ClientWorkspaceMember` fits). */
export type SpaceMemberForMention = { userId?: string; name?: string; avatarUrl?: string; status: WorkspaceMemberStatus };

/**
 * Who `@` lists in a channel (José 25/10): the people of the chat first, then the rest of the
 * space marked `outsideChat` — mentioning them offers to add them, like Slack. Never me, never
 * someone who cannot be reached yet (pending, invited, deactivated, or without a name).
 */
export function mentionCandidates(params: {
  chatMembers: readonly MentionCandidate[];
  spaceMembers: readonly SpaceMemberForMention[] | undefined;
  myUserId: string;
}): MentionCandidate[] {
  const inChat = new Set(params.chatMembers.map((member) => member.id));
  const seen = new Set<string>();
  const outside: MentionCandidate[] = [];
  for (const member of params.spaceMembers ?? []) {
    const { userId } = member;
    const name = member.name?.trim();
    if (!userId || !name || member.status !== 'active') continue;
    if (userId === params.myUserId || inChat.has(userId) || seen.has(userId)) continue;
    seen.add(userId);
    outside.push({ id: userId, nombre: name, ...(member.avatarUrl ? { foto: member.avatarUrl } : {}), outsideChat: true });
  }
  outside.sort((a, b) => compareNamesLoose(a.nombre, b.nombre));
  return [...params.chatMembers, ...outside];
}

/** The people mentioned from outside the chat whose «@Name» is still in the final text, once each. */
export function outsideMentioned(text: string, chosen: readonly MencionElegida[]): MencionElegida[] {
  const outside = new Map(chosen.filter((one) => one.outsideChat).map((one) => [one.userId, one]));
  return [...outside.values()].filter((one) => rangosDeMenciones(text, [{ ...one, outsideChat: false }]).length > 0);
}

/** The line under a message that mentioned people who are not in the channel, and its button. */
export function outsideMentionPrompt(names: readonly string[]): { message: string; action: string } | null {
  if (names.length === 0) return null;
  if (names.length === 1) return { message: `${names[0]} no está en este canal, así que no recibió tu mención.`, action: 'Agregar al canal' };
  const listed = names.length === 2 ? `${names[0]} y ${names[1]}` : `${names[0]}, ${names[1]} y ${names.length - 2} más`;
  return { message: `${listed} no están en este canal, así que no recibieron tu mención.`, action: 'Agregarlos al canal' };
}
