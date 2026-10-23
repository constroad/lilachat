/**
 * A chat notice («Hoy cumple Ana», «Beto se unió») deleted for everyone is not
 * drawn at all (22/10: a deleted birthday notice still showed in the chat).
 * «Se eliminó este mensaje» is for what a person wrote, not for a notice.
 */
export function isHiddenNotice(message: { kind?: string; deletedAt?: string | null }): boolean {
  return message.kind === 'system' && Boolean(message.deletedAt);
}
