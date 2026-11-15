import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import sharp from 'sharp';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { forwardStamped, type ForwardFetch } from './stampedForward.js';

/**
 * José 12/11 («ok si», via Portal): the observations, «Registrar avance» and the Drive tab go to a
 * Portal ticket. With the new camera the phone sends the shot ONCE to us; we burn the stamp while
 * compressing it and forward it, server to server, to that ticket. Only a Portal upload ticket.
 */
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let chat: Types.ObjectId;
const TICKET = 'https://portal.constroad.com/api/public/observation-evidence-upload/abc.def';

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_stamped_forward'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({})]);
  ana = (await UserModel.create({ phone: '987654321', name: 'Ana' }))._id as Types.ObjectId;
  chat = (await ChatModel.create({ kind: 'group', name: 'cliente', members: [{ userId: ana, role: 'member' }], lastSeq: 0 }))._id as Types.ObjectId;
});

const white = () => sharp({ create: { width: 480, height: 320, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
const bodyOf = (overrides: Record<string, string> = {}) => ({ target: TICKET, fileField: 'file', fields: JSON.stringify({ observationId: 'o1' }), clientUploadId: 'u-1', chatId: String(chat), stamp: 'timemark', logo: '0', ...overrides });

describe('forwardStamped', () => {
  it('sends the stamped photo to the ticket with its fields, and answers what Portal answered', async () => {
    // Arrange
    const sent: { url: string; form: FormData }[] = [];
    const fetcher: ForwardFetch = async (url, form) => (sent.push({ url, form }), { status: 201, json: { ok: true, mediaId: 'm-9' } });
    // Act
    const reply = await forwardStamped({ userId: ana, body: bodyOf(), file: { buffer: await white(), mimetype: 'image/jpeg', originalname: 'obs.jpg' } }, fetcher);
    // Assert
    expect(reply).toEqual({ status: 201, json: { ok: true, mediaId: 'm-9' } });
    expect(sent[0]!.url).toBe(TICKET);
    expect(sent[0]!.form.get('observationId')).toBe('o1');
    expect(sent[0]!.form.get('clientUploadId')).toBe('u-1');
    const file = sent[0]!.form.get('file') as File;
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    expect(data[((info.height - 2) * info.width + info.width - 4) * info.channels]!).toBeLessThan(200);
  });

  it('an AR zone\'s photo carries each side\'s meters burned where the phone placed them (José 15/11)', async () => {
    // Arrange
    const sent: FormData[] = [];
    const fetcher: ForwardFetch = async (_url, form) => (sent.push(form), { status: 201, json: { ok: true } });
    const labels = JSON.stringify([{ x: 0.5, y: 0.3, text: '1 · 0,80 m' }]);
    // Act
    await forwardStamped({ userId: ana, body: bodyOf({ labels }), file: { buffer: await white(), mimetype: 'image/jpeg', originalname: 'zona.jpg' } }, fetcher);
    // Assert: dark at the label's middle (480×320 → 240, 96), white above it.
    const file = sent[0]!.get('file') as File;
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    expect(at(205, 96)).toBeLessThan(90);
    expect(at(240, 40)).toBeGreaterThan(240);
  });

  it('refuses anything but a Portal upload ticket, and a chat the person is not in', async () => {
    // Arrange
    const fetcher: ForwardFetch = async () => ({ status: 201, json: {} });
    const file = { buffer: await white(), mimetype: 'image/jpeg', originalname: 'obs.jpg' };
    const stranger = new Types.ObjectId();
    // Act
    const replies = await Promise.all([
      forwardStamped({ userId: ana, body: bodyOf({ target: 'https://evil.example.com/api/public/observation-evidence-upload/x' }), file }, fetcher),
      forwardStamped({ userId: ana, body: bodyOf({ target: 'https://lilachat.constroad.com/api/admin/anything' }), file }, fetcher),
      forwardStamped({ userId: stranger, body: bodyOf(), file }, fetcher),
      forwardStamped({ userId: ana, body: bodyOf(), file: { ...file, mimetype: 'application/pdf' } }, fetcher),
    ]);
    // Assert
    expect(replies.map((reply) => reply.status)).toEqual([400, 400, 403, 415]);
  });
});
