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

export type ExportSetting = { chatId: string; jwt: string; onNotice: (text: string) => void };

/** The tools of the settings tab (B6, B7): a secret chat has neither, the server cannot read it. */
export type ChatTools = { disappear?: DisappearSetting; exportChat?: ExportSetting };

export function chatToolsOf(detail: Parameters<typeof disappearSettingOf>[0], chatId: string, jwt: string, onNotice: (text: string) => void): ChatTools {
  if (detail.encrypted) return {};
  return { disappear: disappearSettingOf(detail, chatId, jwt, onNotice), exportChat: { chatId, jwt, onNotice } };
}
