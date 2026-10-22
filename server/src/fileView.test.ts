import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { signSession } from './sessions.js';

/** A chat's PDF through Lilachat (José, 21/10: the web had no viewer; lila-app does not let other sites frame its files). */
let mongo: MongoMemoryServer;
let files: Server;
let base = '';
const app = buildApp({});
const PDF = Buffer.from('%PDF-1.4\n% qa\n');
let me: Types.ObjectId;
let stranger: Types.ObjectId;
let chatId: Types.ObjectId;
const as = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: 'd', email: 'x' })}`; } });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_fileview'));
  files = createServer((req, res) => {
    if (req.url !== '/files/plano.pdf') return void res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'X-Frame-Options': 'SAMEORIGIN' }).end(PDF);
  });
  await new Promise<void>((resolve) => files.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(files.address() as AddressInfo).port}`;
});
afterAll(async () => {
  files.close();
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [me, stranger] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  chatId = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }], lastSeq: 2 }))._id;
  await MessageModel.create([
    { chatId, seq: 1, senderId: me, clientKey: 'p1', kind: 'file', media: { url: `${base}/files/plano.pdf`, mime: 'application/pdf', fileName: 'plano.pdf', sizeBytes: PDF.length } },
    { chatId, seq: 2, senderId: me, clientKey: 'p2', kind: 'image', media: { url: `${base}/files/foto.jpg`, mime: 'image/jpeg', sizeBytes: 10 } },
  ]);
});

describe('GET /api/chats/:chatId/files/:seq', () => {
  it('a member gets the PDF inline, with its type and name', async () => {
    const response = await request(app).get(`/api/chats/${chatId}/files/1`).set(as(() => me)).buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('inline');
    expect(Buffer.compare(response.body as Buffer, PDF)).toBe(0);
  });

  it('someone outside the chat does not get it, nor what is not a PDF', async () => {
    await request(app).get(`/api/chats/${chatId}/files/1`).set(as(() => stranger)).expect(404);
    await request(app).get(`/api/chats/${chatId}/files/2`).set(as(() => me)).expect(404);
    await request(app).get(`/api/chats/${chatId}/files/1`).expect(401);
  });
});
