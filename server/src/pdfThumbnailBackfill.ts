import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Types } from 'mongoose';
import { MessageModel } from './chatModels.js';
import { MEDIA_PREFIX } from './mediaDisk.js';
import type { PdfThumbnailMaker } from './localMediaUploader.js';

const THUMBS_FOLDER = 'thumbs';
/** A PDF by type or by name, as the upload decides it (`isPdfMedia`). */
const PDF_WITHOUT_PICTURE = {
  'media.url': { $exists: true, $ne: '' },
  'media.thumbUrl': { $in: [null, ''] },
  $or: [{ 'media.mime': 'application/pdf' }, { 'media.fileName': /\.pdf$/i }],
};

export type BackfillOutcome = { found: number; made: number; unreadable: number; failed: number };
type BackfillDeps = { apply: boolean; root: string; read: (url: string) => Promise<Buffer | null>; make: PdfThumbnailMaker };
type PdfMessage = { _id: Types.ObjectId; media: { url: string } };

/** One PDF: read it, draw page 1 into `thumbs/<sha256>.jpg` (the upload's naming) and note it on the message. */
async function drawOne(found: PdfMessage, deps: BackfillDeps): Promise<keyof Omit<BackfillOutcome, 'found'>> {
  const bytes = await deps.read(found.media.url);
  if (!bytes) return 'unreadable';
  const hash = createHash('sha256').update(bytes).digest('hex');
  const source = path.join(tmpdir(), `pdf-backfill-${randomUUID()}.pdf`);
  await writeFile(source, bytes);
  try {
    await mkdir(path.join(deps.root, THUMBS_FOLDER), { recursive: true });
    const drawn = await deps.make(source, path.join(deps.root, THUMBS_FOLDER, `${hash}.jpg`));
    if (!drawn.made) return 'failed';
    await MessageModel.updateOne({ _id: found._id }, { $set: { 'media.thumbUrl': `${MEDIA_PREFIX}${THUMBS_FOLDER}/${hash}.jpg`, 'media.pages': drawn.pages } });
    return 'made';
  } finally {
    await rm(source, { force: true });
  }
}

/**
 * The PDFs sent before the server drew their first page (José 17/11: «Cotización-103» showed only its name).
 * A dry run only counts. Applying draws them one by one (pdf.js is heavy) and writes `media.thumbUrl` and
 * `media.pages`; a file that cannot be read or drawn stays as it was, so a second run picks up only those.
 */
export async function backfillPdfThumbnails(deps: BackfillDeps): Promise<BackfillOutcome> {
  const pending = await MessageModel.find(PDF_WITHOUT_PICTURE).select({ _id: 1, 'media.url': 1 }).lean<PdfMessage[]>();
  const outcome: BackfillOutcome = { found: pending.length, made: 0, unreadable: 0, failed: 0 };
  if (!deps.apply) return outcome;
  for (const found of pending) outcome[await drawOne(found, deps)] += 1;
  return outcome;
}
