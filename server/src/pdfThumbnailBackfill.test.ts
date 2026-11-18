import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { MessageModel } from './chatModels.js';
import { backfillPdfThumbnails } from './pdfThumbnailBackfill.js';

/** José 17/11: the PDFs already in the chats (Cotización-103) also get their first page. */
let mongo: MongoMemoryServer;
let root: string;
const chatId = new Types.ObjectId();
const senderId = new Types.ObjectId();
let seq = 0;

const message = (media: Record<string, unknown>, kind: 'file' | 'image' = 'file') =>
  MessageModel.create({ chatId, seq: ++seq, senderId, clientKey: `k-${seq}`, kind, media });

const pdfBytes = Buffer.from('%PDF-1.4 cotizacion');
const read = async (url: string) => (url.includes('perdido') ? null : pdfBytes);
const made = async (_pdf: string, thumb: string) => {
  await writeFile(thumb, 'jpg');
  return { made: true as const, pages: 3 };
};

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_pdf_backfill_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await MessageModel.deleteMany({});
  root = await mkdtemp(path.join(tmpdir(), 'pdf-backfill-'));
});

describe('backfillPdfThumbnails', () => {
  it('counts the PDFs without a picture and changes nothing on a dry run', async () => {
    await message({ url: '/media/c/cot-103.pdf', mime: 'application/pdf', fileName: 'Cotizacion-103.pdf' });
    await message({ url: '/files/c/acta.PDF', mime: 'application/octet-stream', fileName: 'acta.PDF' });
    await message({ url: '/media/c/ya.pdf', mime: 'application/pdf', fileName: 'ya.pdf', thumbUrl: '/media/thumbs/x.jpg' });
    await message({ url: '/media/c/plano.kml', mime: 'application/vnd.google-earth.kml+xml', fileName: 'plano.kml' });
    await message({ url: '/media/c/foto.jpg', mime: 'image/jpeg', fileName: 'foto.jpg' }, 'image');

    const outcome = await backfillPdfThumbnails({ apply: false, root, read, make: made });

    expect(outcome).toEqual({ found: 2, made: 0, unreadable: 0, failed: 0 });
    expect(await MessageModel.countDocuments({ 'media.thumbUrl': { $exists: true } })).toBe(1);
    expect(await readdir(root)).toEqual([]);
  });

  it('draws the first page into thumbs/ and writes its URL and page count on the message', async () => {
    const pdf = await message({ url: '/media/c/cot-103.pdf', mime: 'application/pdf', fileName: 'Cotizacion-103.pdf' });

    const outcome = await backfillPdfThumbnails({ apply: true, root, read, make: made });

    expect(outcome).toEqual({ found: 1, made: 1, unreadable: 0, failed: 0 });
    const saved = await MessageModel.findById(pdf._id).lean();
    expect(saved?.media?.thumbUrl).toMatch(/^\/media\/thumbs\/[0-9a-f]{64}\.jpg$/);
    expect(saved?.media?.pages).toBe(3);
    expect(await readdir(path.join(root, 'thumbs'))).toEqual([`${saved?.media?.thumbUrl?.split('/').pop()}`]);
  });

  it('leaves alone a file it cannot read or draw, and goes on with the rest', async () => {
    const lost = await message({ url: '/media/c/perdido.pdf', mime: 'application/pdf', fileName: 'perdido.pdf' });
    const broken = await message({ url: '/media/c/roto.pdf', mime: 'application/pdf', fileName: 'roto.pdf' });
    const good = await message({ url: '/media/c/bueno.pdf', mime: 'application/pdf', fileName: 'bueno.pdf' });
    let calls = 0;
    const flaky = async (pdf: string, thumb: string) => (++calls === 1 ? { made: false as const } : made(pdf, thumb));

    const outcome = await backfillPdfThumbnails({ apply: true, root, read, make: flaky });

    expect(outcome).toEqual({ found: 3, made: 1, unreadable: 1, failed: 1 });
    expect((await MessageModel.findById(lost._id).lean())?.media?.thumbUrl).toBeUndefined();
    expect((await MessageModel.findById(broken._id).lean())?.media?.thumbUrl).toBeUndefined();
    expect((await MessageModel.findById(good._id).lean())?.media?.thumbUrl).toBeDefined();
  });

  it('a second run finds nothing left', async () => {
    await message({ url: '/media/c/cot-103.pdf', mime: 'application/pdf', fileName: 'Cotizacion-103.pdf' });
    await backfillPdfThumbnails({ apply: true, root, read, make: made });

    expect(await backfillPdfThumbnails({ apply: true, root, read, make: made })).toEqual({ found: 0, made: 0, unreadable: 0, failed: 0 });
  });
});
