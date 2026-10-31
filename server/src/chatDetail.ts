import { Types } from 'mongoose';
import { memberPermissionsOf, muteStateOf, notificationLevel } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { GENERAL_CHANNEL } from './workspaceGeneral.js';

/** Pending 17: my own routines in this chat, only for me; nothing when there are none. */
function routinesOf(mine: { quietHours?: unknown; contactNote?: unknown } | undefined) {
  if (!mine?.quietHours && !mine?.contactNote) return {};
  return { routines: { ...(mine.quietHours ? { quietHours: mine.quietHours } : {}), ...(mine.contactNote ? { contactNote: mine.contactNote } : {}) } };
}

/**
 * A conversation's detail: who is in it and with what role (`GET
 * /api/chats/:chatId/detail`).
 *
 * It exists for the design's «Chat Detail» screen
 * (`design/stitch/info-grupo-alpha.png`). `GET /api/chats` gives the
 * `memberIds` but not the names, so the screen had nothing to draw the list
 * with.
 *
 * **It returns each member's phone** for the same reason as the chat summary:
 * the server only knows the name each person set, and the one that matters —
 * the one in YOUR address book — can only be resolved by the phone. It leaks
 * nothing new: these are people you already share a conversation with.
 */
export async function chatDetail(chatId: string, userId: Types.ObjectId) {
  // Membership first: without it, the gap between «does not exist» and «not
  // allowed» would let anyone probe for other people's chats.
  if (!Types.ObjectId.isValid(chatId)) return null;
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': userId }).lean();
  if (!chat) return null;
  const ids = chat.members.map((m) => m.userId);
  const people = await UserModel.find({ _id: { $in: ids } })
    .select('name phone avatarUrl app')
    .lean<{ _id: unknown; name?: string; phone: string; avatarUrl?: string; app?: unknown }[]>();
  const personById = new Map(people.map((person) => [String(person._id), person]));
  // In a company space the pill says the job title and the space role (design s-01), not the chat's.
  const spaceMembers = chat.workspaceId ? await WorkspaceMemberModel.find({ workspaceId: chat.workspaceId, userId: { $in: ids } }).select('userId title role').lean() : [];
  const spaceMemberById = new Map(spaceMembers.map((member) => [String(member.userId), member]));
  // In a 1:1 the photo IS the other person's profile photo (FL9), as in the list.
  const other = chat.kind === 'direct' ? people.find((person) => String(person._id) !== String(userId)) : undefined;
  const photo = chat.avatarUrl ?? other?.avatarUrl;
  return {
    id: String(chat._id),
    kind: chat.kind,
    name: chat.name,
    descripcion: chat.descripcion,
    funAllowed: chat.funAllowed === true,
    // Pending 8: what the members may do; the screen shows it to everyone and lets admins change it.
    ...(chat.kind === 'group' ? { memberPermissions: memberPermissionsOf(chat.memberPermissions) } : {}),
    birthdaysOn: chat.birthdaysOn === true,
    // Pending 9: only whoever blocked learns it; the other side sees a normal 1:1.
    ...routinesOf(chat.members.find((m) => String(m.userId) === String(userId))),
    ...(chat.kind === 'direct' ? { blockedByMe: (chat.blockedBy ?? []).some((id) => String(id) === String(userId)) } : {}),
    encrypted: chat.encrypted === true,
    // Pending 93: a channel's admins change who finds it; #general is always public.
    ...(chat.channel ? { channel: { visibility: chat.channel.visibility, general: chat.name === GENERAL_CHANNEL } } : {}),
    // MY mute (it is per person): the detail's switch shows it as it is,
    // instead of always starting off.
    // R31/10: muted only while it holds, with its end («Silenciado hasta…»).
    ...muteStateOf(chat.members.find((m) => String(m.userId) === String(userId))),
    avisos: notificationLevel(chat.members.find((m) => String(m.userId) === String(userId)) ?? {}),
    avatarUrl: photo ? toAbsoluteMediaUrl(photo) : undefined,
    members: chat.members.map((m) => {
      const person = personById.get(String(m.userId));
      const inSpace = spaceMemberById.get(String(m.userId));
      return {
        id: String(m.userId),
        name: person?.name ?? null,
        // An installed app (Lila) has no phone to show: its `phone` is an internal key. Its pill says «App».
        phone: person?.app ? null : (person?.phone ?? null),
        ...(person?.app ? { app: true } : {}),
        // Each person's photo (FL13d): the detail and the group's bubbles.
        avatarUrl: person?.avatarUrl ? toAbsoluteMediaUrl(person.avatarUrl) : undefined,
        role: m.role ?? 'member',
        esYo: String(m.userId) === String(userId),
        ...(inSpace ? { spaceRole: inSpace.role, ...(inSpace.title ? { title: inSpace.title } : {}) } : {}),
      };
    }),
  };
}
