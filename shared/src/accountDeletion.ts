import type { WorkspaceRole } from './workspaces.js';

/**
 * Deleting one's account (Google Play, José 19/11). Pure engine shared by the
 * server, the web and the APK.
 *
 * Asking closes the account at once; erasing it waits a grace period, and a
 * sign-in with the code inside it cancels the deletion. Messages in groups and
 * channels stay, signed with `DELETED_ACCOUNT_NAME`, like WhatsApp.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;
export const DELETED_ACCOUNT_NAME = 'Cuenta eliminada';
export const ACCOUNT_DELETION_CONFIRM_WORD = 'BORRAR';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Peru has no daylight saving: Lima is always five hours behind UTC. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
const SHORT_MONTHS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'set.', 'oct.', 'nov.', 'dic.'] as const;

export type AccountDeletionState = 'none' | 'pending' | 'due' | 'erased';

export const accountDeletionDeadline = (requestedAt: Date): Date => new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);

const isValidDate = (value: Date | undefined | null): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

/** Where an account stands: an unreadable date counts as no request, never as «erase it». */
export function accountDeletionState(account: { requestedAt?: Date | null; purgedAt?: Date | null }, now: Date): AccountDeletionState {
  if (isValidDate(account.purgedAt)) return 'erased';
  if (!isValidDate(account.requestedAt)) return 'none';
  return now.getTime() >= accountDeletionDeadline(account.requestedAt).getTime() ? 'due' : 'pending';
}

/** The word typed confirms it: the same letters, not minding case or spaces around. */
export function confirmsAccountDeletion(typed: unknown): boolean {
  return typeof typed === 'string' && typed.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRM_WORD;
}

/** One active membership of the person, with who else is in that space. */
export type DeletionMembership = { spaceName: string; role: WorkspaceRole; otherActiveMembers: number; otherManagers: number };

/**
 * The spaces that would be left without anyone in charge: the owner of a space
 * with other people (there is one owner, and nobody else can delete it), or its
 * only admin. A space where the owner is alone is deleted with the account.
 */
export function spacesBlockingDeletion(memberships: readonly DeletionMembership[]): string[] {
  return memberships
    .filter((membership) => membership.otherActiveMembers > 0)
    .filter((membership) => membership.role === 'owner' || (membership.role === 'admin' && membership.otherManagers === 0))
    .map((membership) => membership.spaceName);
}

const quotedList = (names: readonly string[]): string => {
  const quoted = names.map((name) => `«${name}»`);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} y ${quoted[quoted.length - 1]}` : (quoted[0] ?? '');
};

export function deletionBlockedMessage(spaceNames: readonly string[]): string {
  const subject = spaceNames.length > 1 ? `los espacios ${quotedList(spaceNames)}, que tienen` : `el espacio ${quotedList(spaceNames)}, que tiene`;
  return `Estás a cargo de ${subject} otros miembros. Pasa el espacio a otra persona o elimínalo antes de borrar tu cuenta.`;
}

/** «19 dic. 2026», the day in Lima. */
export function deletionDateLabel(at: Date): string {
  const lima = new Date(at.getTime() + LIMA_OFFSET_MS);
  return `${lima.getUTCDate()} ${SHORT_MONTHS[lima.getUTCMonth()]} ${lima.getUTCFullYear()}`;
}

export const deletionClosedLine = (deadline: Date): string =>
  `Tu cuenta se cerró. Se borrará el ${deletionDateLabel(deadline)}. Si entras antes con tu código, se cancela el borrado.`;

/** What the confirmation explains, the same words in the web, the APK and the public page. */
export const ACCOUNT_DELETION_TEXTS = {
  title: 'Borrar mi cuenta',
  erased: [
    'Tu nombre, teléfono, correo, cumpleaños y foto.',
    'Tus sesiones, dispositivos y avisos.',
    'Tus chats 1:1, tus contactos bloqueados y tu respuesta automática.',
    'Tus stickers, destacados, recordatorios y respaldos.',
  ],
  kept: 'Tus mensajes en grupos, canales y canales de cliente quedan, firmados «Cuenta eliminada».',
  grace: `Tu cuenta se cierra al instante y se borra en ${ACCOUNT_DELETION_GRACE_DAYS} días. Si entras antes con tu código, se cancela el borrado.`,
  confirmPrompt: `Escribe ${ACCOUNT_DELETION_CONFIRM_WORD} para confirmar.`,
  confirmAction: 'Borrar mi cuenta',
  cancelledTitle: 'Se canceló el borrado',
  cancelledBody: 'Habías pedido borrar tu cuenta. Como volviste a entrar, tu cuenta sigue activa.',
} as const;
