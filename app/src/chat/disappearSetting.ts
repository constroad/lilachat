import { memberMay } from '@lilachat/shared';

export type DisappearSetting = { chatId: string; jwt: string; seconds: number; canChange: boolean; onNotice: (text: string) => void };

/** The row's data from the chat detail; none in a channel, a secret chat or the notes chat (the server refuses them too). */
export function disappearSettingOf(
  detail: { kind: string; encrypted: boolean; channel?: unknown; disappearSeconds?: number; memberPermissions?: unknown; members: { esYo?: boolean; role?: string }[] },
  chatId: string,
  jwt: string,
  onNotice: (text: string) => void
): DisappearSetting | undefined {
  if (detail.encrypted || detail.channel || (detail.kind !== 'direct' && detail.kind !== 'group')) return undefined;
  const admin = detail.members.some((member) => member.esYo && member.role === 'admin');
  const canChange = detail.kind === 'direct' || memberMay({ permission: 'editInfo', role: admin ? 'admin' : 'member', permissions: detail.memberPermissions });
  return { chatId, jwt, seconds: detail.disappearSeconds ?? 0, canChange, onNotice };
}
