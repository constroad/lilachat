import { Schema, Types, model } from 'mongoose';
import { botUploadKindOf, readableFileName, type BotUploadKind } from '@lilachat/shared';
import { toAbsoluteMediaUrl, type MediaUploader } from '../mediaClient.js';

/**
 * A file agentes uploaded for a channel (José 17/11: a prospect's KML, photo or PDF with metrados). It lives in
 * our media like a member's file; a post names it by `file_id` (`files: [{ file_id }]`). It never expires: a
 * retried post reuses it. Looked up by `_id` and installation, so it needs no index of its own.
 */
export type BotUpload = { _id: Types.ObjectId; installationId: Types.ObjectId; storageName: string; url: string; thumbUrl?: string; mime: string; name: string; size: number; kind: BotUploadKind; pages?: number; /** The photo's or video's own shape (José via agentes 20/11): without it the bubble cropped it into a square. */ width?: number; height?: number; createdAt: Date };

const uploadSchema = new Schema<BotUpload>(
  {
    installationId: { type: Schema.Types.ObjectId, required: true },
    storageName: { type: String, required: true },
    url: { type: String, required: true },
    thumbUrl: String,
    mime: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, required: true },
    pages: Number,
    width: Number,
    height: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const BotUploadModel = model<BotUpload>('BotUpload', uploadSchema);

type UploadFailure = { ok: false; status: 415 | 502 | 503; error: string; message: string };
export type ReceivedFile = { buffer: Buffer; mimetype: string; originalname: string; size: number };

/** Stores what agentes sent, or says why not: a type off the list is 415, a storage that did not answer 503. */
export async function storeBotUpload(installationId: Types.ObjectId, file: ReceivedFile, uploader: MediaUploader): Promise<{ ok: true; upload: BotUpload } | UploadFailure> {
  const name = readableFileName(file.originalname);
  const kind = botUploadKindOf(file.mimetype, name);
  if (!kind) return { ok: false, status: 415, error: 'unsupported_type', message: 'Solo fotos, videos mp4 y documentos (pdf, kml, kmz, xlsx, docx, dwg).' };
  const stored = await uploader.upload({ chatId: `bot-${String(installationId)}`, fileName: name, mimeType: file.mimetype, kind, bytes: file.buffer });
  if (!stored.ok) {
    const retryable = stored.codigo !== 'rechazado';
    return { ok: false, status: retryable ? 503 : 502, error: retryable ? 'storage_unavailable' : 'storage_refused', message: retryable ? 'No se pudo guardar ahora. Inténtalo de nuevo.' : 'El archivo no se pudo guardar.' };
  }
  const upload = await BotUploadModel.create({ installationId, storageName: stored.media.storageName, url: stored.media.url, ...(stored.media.thumbnailUrl ? { thumbUrl: stored.media.thumbnailUrl } : {}), mime: file.mimetype, name, size: file.size, kind, ...(stored.media.pages ? { pages: stored.media.pages } : {}), ...(stored.media.width && stored.media.height ? { width: stored.media.width, height: stored.media.height } : {}) });
  return { ok: true, upload: upload.toObject() };
}

/** What the upload answers: the id to post with and where it lives. */
export const uploadAnswerOf = (upload: BotUpload) => ({ file_id: String(upload._id), url: toAbsoluteMediaUrl(upload.url), mime: upload.mime, name: upload.name, size: upload.size });

/** The uploads a post names, in its order; null when one is not this installation's. */
export async function uploadsOf(installationId: Types.ObjectId, ids: readonly string[]): Promise<BotUpload[] | null> {
  const found = await BotUploadModel.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) }, installationId }).lean<BotUpload[]>();
  const byId = new Map(found.map((upload) => [String(upload._id), upload]));
  const ordered = ids.map((id) => byId.get(id));
  return ordered.every((upload): upload is BotUpload => upload !== undefined) ? ordered : null;
}
