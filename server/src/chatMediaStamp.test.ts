import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { signSession } from './sessions.js';

/**
 * José 12/11: «en los chats de canales, cuando se presiona la cámara, debería mostrarse (y permitir
 * foto y video)» with the Timemark-like stamp. The phone sends the shot whole and asks for the stamp;
 * the server burns it once, compressing it in the same pass.
 */
const run = promisify(execFile);
let mongo: MongoMemoryServer;
const stored: { fileName: string; mimeType: string; bytes: Buffer }[] = [];
const app = buildApp({ mediaUploader: { async upload(params) { stored.push(params); return { ok: true, media: { url: `/files/${params.fileName}`, storageName: `st-${params.fileName}`, sizeBytes: params.bytes.length } }; } } });
let ana: Types.ObjectId;
let chat: Types.ObjectId;
const asAna = { get Authorization() { return `Bearer ${signSession({ userId: String(ana), deviceId: 'd-ana', email: 'x' })}`; } };
const stampFields = { stamp: 'timemark', logo: '1', lat: '-12.0217', lng: '-76.8817', precision: '6' };

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_chat_media_stamp'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  stored.length = 0;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  const [jose, anaUser] = await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }]);
  ana = anaUser!._id as Types.ObjectId;
  chat = (await ChatModel.create({ kind: 'group', name: 'planta', members: [{ userId: jose!._id, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id as Types.ObjectId;
});

const send = (file: Buffer, name: string, type: string, fields: Record<string, string>) => {
  const sent = request(app).post('/api/media').set(asAna).field('chatId', String(chat)).field('clientKey', `k-${name}`);
  for (const [field, value] of Object.entries(fields)) sent.field(field, value);
  return sent.attach('file', file, { filename: name, contentType: type });
};

describe('the chat camera\'s stamp', () => {
  it('a photo comes out stamped at the bottom, the top untouched, as a JPEG', async () => {
    // Arrange
    const white = await sharp({ create: { width: 480, height: 320, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    // Act
    await send(white, 'foto.jpg', 'image/jpeg', stampFields).expect(201);
    // Assert
    const { data, info } = await sharp(stored[0]!.bytes).raw().toBuffer({ resolveWithObject: true });
    expect(stored[0]!.mimeType).toBe('image/jpeg');
    expect(data[(4 * info.width + 4) * info.channels]!).toBeGreaterThan(240);
    expect(data[((info.height - 2) * info.width + info.width - 4) * info.channels]!).toBeLessThan(200);
  });

  it('a video comes out stamped as an MP4, and its message says so', async () => {
    // Arrange
    const folder = await mkdtemp(join(tmpdir(), 'chat-stamp-test-'));
    const clip = join(folder, 'clip.mp4');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=640x360:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip]);
    // Act
    await send(await readFile(clip), 'video.mp4', 'video/mp4', stampFields).expect(201);
    // Assert
    expect(stored[0]).toMatchObject({ mimeType: 'video/mp4' });
    expect(stored[0]!.bytes.subarray(4, 8).toString('ascii')).toBe('ftyp');
    const message = await MessageModel.findOne({ chatId: chat, kind: 'video' }).lean();
    expect(message?.media?.sizeBytes).toBe(stored[0]!.bytes.length);
    const [out, frame] = [join(folder, 'out.mp4'), join(folder, 'frame.png')];
    await import('node:fs/promises').then((fs) => fs.writeFile(out, stored[0]!.bytes));
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-frames:v', '1', frame]);
    const { data, info } = await sharp(frame).raw().toBuffer({ resolveWithObject: true });
    expect(data[((info.height - 3) * info.width + info.width - 6) * info.channels]!).toBeLessThan(200);
    await rm(folder, { recursive: true, force: true });
  }, 60_000);

  it('without the stamp asked, the file goes exactly as it came', async () => {
    // Arrange
    const white = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    // Act
    await send(white, 'galeria.jpg', 'image/jpeg', {}).expect(201);
    // Assert
    expect(stored[0]!.bytes.equals(white)).toBe(true);
  });
});
