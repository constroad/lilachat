/**
 * What the members of a group may do (pending 8, design `permisos-admin`), like
 * WhatsApp's group settings. Admins can always do everything; each switch says
 * whether the rest can too. Without the field the group works as it always did:
 * anyone edits, writes and adds; only admins pin. PURE.
 */
export type MemberPermission = 'editInfo' | 'sendMessages' | 'addMembers' | 'pinMessages';
export type MemberPermissions = Record<MemberPermission, boolean>;

export const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = { editInfo: true, sendMessages: true, addMembers: true, pinMessages: false };

export const MEMBER_PERMISSION_ROWS: readonly { key: MemberPermission; title: string; detail: string }[] = [
  { key: 'editInfo', title: 'Editar la info del grupo', detail: 'Cambiar el nombre, la foto y la descripción.' },
  { key: 'sendMessages', title: 'Enviar mensajes', detail: 'Escribir, mandar fotos, archivos y notas de voz.' },
  { key: 'addMembers', title: 'Agregar miembros', detail: 'Sumar a otras personas al grupo.' },
  { key: 'pinMessages', title: 'Fijar mensajes', detail: 'Fijar mensajes importantes arriba del chat.' },
];

const DENIED: Record<MemberPermission, string> = {
  editInfo: 'Solo los admins pueden cambiar la info de este grupo.',
  sendMessages: 'Solo los admins pueden enviar mensajes en este grupo.',
  addMembers: 'Solo los admins pueden agregar miembros a este grupo.',
  pinMessages: 'En este grupo, solo los admins fijan mensajes.',
};

/** The stored switches with the defaults filled in; anything that is not a boolean counts as unset. */
export function memberPermissionsOf(raw: unknown): MemberPermissions {
  const stored = raw && typeof raw === 'object' ? (raw as Partial<Record<MemberPermission, unknown>>) : {};
  const pick = (key: MemberPermission) => (typeof stored[key] === 'boolean' ? (stored[key] as boolean) : DEFAULT_MEMBER_PERMISSIONS[key]);
  return { editInfo: pick('editInfo'), sendMessages: pick('sendMessages'), addMembers: pick('addMembers'), pinMessages: pick('pinMessages') };
}

/** May this person do it? An admin always may. */
export function memberMay(input: { permission: MemberPermission; role: 'admin' | 'member' | undefined; permissions: unknown }): boolean {
  return input.role === 'admin' || memberPermissionsOf(input.permissions)[input.permission];
}

export const memberPermissionDenied = (permission: MemberPermission): string => DENIED[permission];

/** A change from the screen: only the four known switches, only booleans; nothing valid is `null`. */
export function memberPermissionsPatch(raw: unknown): Partial<MemberPermissions> | null {
  if (!raw || typeof raw !== 'object') return null;
  const patch: Partial<MemberPermissions> = {};
  for (const { key } of MEMBER_PERMISSION_ROWS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'boolean') patch[key] = value;
  }
  return Object.keys(patch).length ? patch : null;
}
