import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { sendMessage } from '../src/chatService.js';
import { CustomEmojiModel } from '../src/customEmojiModel.js';
import type { MediaUploader } from '../src/mediaClient.js';
import { UserModel } from '../src/models.js';
import { reaccionar } from '../src/reacciones.js';
import { signSession } from '../src/sessions.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../src/workspaceModels.js';

/** Pending 19: a space's own emojis, added by members and used as reactions in that space only. */
let mongo: MongoMemoryServer;
let owner: Types.ObjectId;
let member: Types.ObjectId;
let outsider: Types.ObjectId;
let workspaceId: string;
let uploads = 0;

const uploader: MediaUploader = {
  upload: async (params) => {
    uploads += 1;
    return { ok: true, media: { url: `/files/emojis/${params.fileName}`, sizeBytes: params.bytes.length, storageName: params.fileName } };
  },
};
const app = () => buildApp({ mediaUploader: uploader });
const auth = (userId: Types.ObjectId) => `Bearer ${signSession({ userId: String(userId), deviceId: 'd1', email: `${userId}@x.com` })}`;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const addEmoji = (userId: Types.ObjectId, name: string, file: Buffer = png) =>
  request(app()).post(`/api/workspaces/${workspaceId}/emojis`).set('Authorization', auth(userId)).field('name', name).attach('file', file, { filename: 'e.png', contentType: 'image/png' });

beforeAll(async () => {
  process.env.LILA_PUBLIC_URL = 'https://lila.constroad.com';
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_custom_emojis'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  uploads = 0;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({}), CustomEmojiModel.deleteMany({})]);
  [owner, member, outsider] = (await UserModel.create(['Dueño', 'Ana', 'Ajeno'].map((name, i) => ({ phone: `90000002${i}`, name })))).map((u) => u._id);
  const workspace = await WorkspaceModel.create({ name: 'Obra', ownerId: owner, joinCode: 'OBRA-1234', joinPolicy: 'approval' });
  workspaceId = String(workspace._id);
  await WorkspaceMemberModel.create([
    { workspaceId: workspace._id, userId: owner, phone: '900000020', role: 'owner', status: 'active' },
    { workspaceId: workspace._id, userId: member, phone: '900000021', role: 'member', status: 'active' },
  ]);
});

describe('custom emojis', () => {
  it('a member adds one; the name is normalized and the list serves the image absolute', async () => {
    const added = await addEmoji(member, ':Casco OK:');

    expect(added.status).toBe(201);
    expect(added.body.emoji).toMatchObject({ name: 'casco-ok', animated: false, createdBy: String(member) });
    const list = await request(app()).get(`/api/workspaces/${workspaceId}/emojis`).set('Authorization', auth(owner));
    expect(list.body.emojis).toHaveLength(1);
    expect(list.body.emojis[0].url).toBe('https://lila.constroad.com/files/emojis/casco-ok.png');
  });

  it('rejects a repeated name, a file that is not an image, a bad name and someone outside the space', async () => {
    await addEmoji(member, 'casco');

    expect((await addEmoji(owner, 'Casco')).status).toBe(409);
    expect((await addEmoji(owner, 'texto', Buffer.from('hola, no soy imagen'))).status).toBe(400);
    expect((await addEmoji(owner, 'x')).status).toBe(400);
    expect((await addEmoji(outsider, 'otro')).status).toBe(404);
    expect((await addEmoji(owner, 'grande', Buffer.concat([png, Buffer.alloc(300 * 1024)]))).status).toBe(400);
    expect(uploads).toBe(1);
  });

  it('only its author or an admin removes it', async () => {
    const id = (await addEmoji(owner, 'jefe')).body.emoji.id;
    const remove = (userId: Types.ObjectId) => request(app()).delete(`/api/workspaces/${workspaceId}/emojis/${id}`).set('Authorization', auth(userId));

    expect((await remove(member)).status).toBe(403);
    expect((await remove(owner)).status).toBe(204);
    expect(await CustomEmojiModel.countDocuments({})).toBe(0);
    expect((await remove(owner)).status).toBe(404);
  });

  it('reacts with :name: in a chat of the space, never in another chat nor with an emoji it does not have', async () => {
    await addEmoji(member, 'casco');
    const channel = await ChatModel.create({ kind: 'group', name: 'general', workspaceId: new Types.ObjectId(workspaceId), members: [owner, member].map((userId) => ({ userId })), lastSeq: 0 });
    const privateGroup = await ChatModel.create({ kind: 'group', name: 'Casa', members: [owner, member].map((userId) => ({ userId })), lastSeq: 0 });
    const inChannel = await sendMessage({ chatId: String(channel._id), senderId: owner, clientKey: 'k-1', body: 'Llegó la tolva' });
    const inPrivateGroup = await sendMessage({ chatId: String(privateGroup._id), senderId: owner, clientKey: 'k-2', body: 'Hola' });

    const ok = await reaccionar({ chatId: String(channel._id), seq: inChannel.message.seq, userId: String(member), emoji: ':casco:' });
    const elsewhere = await reaccionar({ chatId: String(privateGroup._id), seq: inPrivateGroup.message.seq, userId: String(member), emoji: ':casco:' });
    const unknown = await reaccionar({ chatId: String(channel._id), seq: inChannel.message.seq, userId: String(member), emoji: ':nada:' });

    expect(ok).toMatchObject({ ok: true, reacciones: [{ userId: String(member), emoji: ':casco:' }] });
    expect(elsewhere).toMatchObject({ ok: false, status: 400 });
    expect(unknown).toMatchObject({ ok: false, status: 400 });
  });
});
