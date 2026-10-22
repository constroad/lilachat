/**
 * The chat header's menus, like WhatsApp's (José, 21/10): the ⋮ with what
 * this app does for this chat (never an option without a backend), and the
 * camera with its arrow for the calls. PURE: the screen only draws them.
 */
export type ChatMenuKind = 'group' | 'channel' | 'direct' | 'notes';
export type ChatMenuId = 'add-members' | 'info' | 'media' | 'search' | 'mute' | 'unmute';
export type ChatMenuOption = { id: ChatMenuId; label: string };
export type CallMenuId = 'voice' | 'video';

const INFO_LABEL: Record<ChatMenuKind, string> = { group: 'Info del grupo', channel: 'Info del canal', direct: 'Ver contacto', notes: 'Info' };
const MEDIA_LABEL: Record<ChatMenuKind, string> = { group: 'Medios del grupo', channel: 'Medios del canal', direct: 'Medios, enlaces y docs', notes: 'Medios, enlaces y docs' };

export function chatMenuOptions(params: { kind: ChatMenuKind; muted: boolean }): ChatMenuOption[] {
  const { kind } = params;
  const many = kind === 'group' || kind === 'channel';
  return [
    ...(many ? [{ id: 'add-members' as const, label: 'Agregar miembros' }] : []),
    { id: 'info', label: INFO_LABEL[kind] },
    { id: 'media', label: MEDIA_LABEL[kind] },
    { id: 'search', label: 'Buscar' },
    ...(kind === 'notes' ? [] : [params.muted ? { id: 'unmute' as const, label: 'Activar notificaciones' } : { id: 'mute' as const, label: 'Silenciar notificaciones' }]),
  ];
}

export const CALL_MENU: readonly { id: CallMenuId; label: string }[] = [
  { id: 'voice', label: 'Llamada de voz' },
  { id: 'video', label: 'Videollamada' },
];
