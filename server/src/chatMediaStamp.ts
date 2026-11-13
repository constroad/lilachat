import type { Types } from 'mongoose';
import { timemarkOf } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { placeNameOf } from './placeName.js';
import { stampTimemark } from './bots/photoStamp.js';
import { spaceStampLogo } from './bots/spaceStampLogo.js';
import type { PhotoStampAsked } from './bots/botForms.js';
import { stampVideo } from './videoStamp.js';

export type ChatFile = { bytes: Buffer; mimeType: string; fileName: string };
const MP4 = 'video/mp4';

const baseName = (fileName: string) => fileName.replace(/\.\w+$/, '');

/**
 * A photo or a video from the chat's camera with the Timemark-like stamp (José 12/11, designs
 * cam-01 and cam-05): the hour it was taken, the date, the address and the space's logo when its
 * chip was on. It is burned once, in the pass that compresses it; the phone sent it whole.
 * Null when it cannot be burned: the caller sends the file as it came.
 */
export async function stampedChatMedia(file: ChatFile, kind: 'image' | 'video', asked: PhotoStampAsked, chatId: string): Promise<ChatFile | null> {
  const place = asked.location ? await placeNameOf(asked.location) : null;
  const workspaceId = asked.timemark?.logo ? ((await ChatModel.findById(chatId).select('workspaceId').lean())?.workspaceId as Types.ObjectId | undefined) : undefined;
  const logo = await spaceStampLogo(workspaceId);
  const stamp = timemarkOf({ at: asked.takenAt ?? new Date(), point: asked.location ?? null, place });
  try {
    if (kind === 'video') {
      const video = await stampVideo(file.bytes, stamp, logo);
      return video ? { bytes: video, mimeType: MP4, fileName: `${baseName(file.fileName)}.mp4` } : null;
    }
    const photo = await stampTimemark(file.bytes, stamp, logo);
    return { bytes: photo.bytes, mimeType: photo.mimeType, fileName: `${baseName(file.fileName)}.jpg` };
  } catch (error) {
    console.warn('[media] sin sello:', error instanceof Error ? error.message.slice(0, 200) : error);
    return null;
  }
}
