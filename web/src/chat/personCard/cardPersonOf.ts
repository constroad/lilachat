import { personOfMember, type CardPerson } from '@lilachat/shared';
import type { DetalleDelChat } from '../useDetalleDelChat';

/**
 * The card of whoever was tapped in the open chat (José, 25/10/2026): from the chat's detail
 * when they are still a member, and from the name the message drew when they are not
 * (they left the group). Nobody for me: there is no one to write to.
 */
export function cardPersonOf(params: { userId: string; detail: DetalleDelChat | null; names: ReadonlyMap<string, string>; myUserId: string }): CardPerson | null {
  const { userId, detail } = params;
  if (userId === params.myUserId) return null;
  const member = detail?.miembros.get(userId);
  return personOfMember({
    member: { id: userId, name: member?.nombre, phone: member?.telefono, avatarUrl: member?.foto, app: detail?.appIds?.has(userId) },
    displayName: params.names.get(userId) ?? member?.nombre,
    pill: detail?.pills.get(userId),
    isMe: false,
  });
}
