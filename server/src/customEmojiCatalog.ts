import { Types } from 'mongoose';
import { customEmojiKindOf, customEmojiNameOf, type CustomEmoji } from '@lilachat/shared';
import { CustomEmojiModel, type CustomEmojiDoc } from './customEmojiModel.js';
import { toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { actorIn, WorkspaceError } from './workspaces.js';

/** Most a space keeps: Slack has no cap, but a picker with thousands is no picker. */
export const MAX_CUSTOM_EMOJIS = 500;
const REMOVES_ANY = new Set(['owner', 'admin']);

const toClient = (doc: CustomEmojiDoc): CustomEmoji => ({
  id: String(doc._id),
  name: doc.name,
  url: toAbsoluteMediaUrl(doc.url),
  animated: doc.animated,
  createdBy: String(doc.createdBy),
  createdAt: doc.createdAt.toISOString(),
});

/** The space's emojis, for any active member (pending 19). */
export async function listCustomEmojis(workspaceId: string, userId: Types.ObjectId): Promise<CustomEmoji[]> {
  const member = await actorIn(workspaceId, userId);
  const docs = await CustomEmojiModel.find({ workspaceId: member.workspaceId }).sort({ name: 1 }).limit(MAX_CUSTOM_EMOJIS).lean<CustomEmojiDoc[]>();
  return docs.map(toClient);
}

/** Any member adds one, like Slack by default; the name is unique in the space and the image is checked by its bytes. */
export async function addCustomEmoji(params: { workspaceId: string; userId: Types.ObjectId; name: unknown; bytes: Buffer | undefined; uploader: MediaUploader }): Promise<CustomEmoji> {
  const member = await actorIn(params.workspaceId, params.userId);
  const name = customEmojiNameOf(params.name);
  if (!name) throw new WorkspaceError(400, 'El nombre va de 2 a 32 letras sin tildes, números, «-» o «_».');
  const kind = params.bytes ? customEmojiKindOf(params.bytes) : null;
  if (!params.bytes || !kind) throw new WorkspaceError(400, 'La imagen tiene que ser PNG, WebP o GIF de hasta 256 KB.');
  if (await CustomEmojiModel.exists({ workspaceId: member.workspaceId, name })) throw new WorkspaceError(409, `Ya hay un emoji :${name}: en este espacio.`);
  if ((await CustomEmojiModel.countDocuments({ workspaceId: member.workspaceId })) >= MAX_CUSTOM_EMOJIS) throw new WorkspaceError(409, 'Este espacio ya tiene el máximo de emojis.');
  const extension = kind.mime.split('/')[1];
  const uploaded = await params.uploader.upload({ chatId: `emojis-${params.workspaceId}`, fileName: `${name}.${extension}`, mimeType: kind.mime, kind: 'image', bytes: params.bytes });
  if (!uploaded.ok) throw new WorkspaceError(409, 'No se pudo guardar la imagen. Prueba de nuevo.');
  const doc = await CustomEmojiModel.create({ workspaceId: member.workspaceId, name, url: uploaded.media.url, mime: kind.mime, animated: kind.animated, createdBy: params.userId });
  return toClient(doc.toObject());
}

/** Whoever added it, or an admin, takes it out. Reactions that used it keep their image. */
export async function removeCustomEmoji(workspaceId: string, userId: Types.ObjectId, emojiId: string): Promise<void> {
  const member = await actorIn(workspaceId, userId);
  if (!Types.ObjectId.isValid(emojiId)) throw new WorkspaceError(404, 'Ese emoji ya no está.');
  const emoji = await CustomEmojiModel.findOne({ _id: new Types.ObjectId(emojiId), workspaceId: member.workspaceId }).lean<CustomEmojiDoc | null>();
  if (!emoji) throw new WorkspaceError(404, 'Ese emoji ya no está.');
  if (!REMOVES_ANY.has(member.role) && String(emoji.createdBy) !== String(userId)) throw new WorkspaceError(403, 'Solo quien lo agregó o un admin lo puede quitar.');
  await CustomEmojiModel.deleteOne({ _id: emoji._id });
}

/** Whether the space has an emoji with that name: a reaction with `:name:` is valid only then. */
export async function hasCustomEmoji(workspaceId: Types.ObjectId, name: string): Promise<boolean> {
  return Boolean(await CustomEmojiModel.exists({ workspaceId, name }));
}
