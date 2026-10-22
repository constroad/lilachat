import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import type { AuthClient } from './authClient.js';
import { InvitationModel, UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { WorkspaceEmailInviteModel, WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { claimPhoneInvites } from './workspaces.js';
import { signSession } from './sessions.js';

/**
 * José, 22/10: «X se unió» lands in the space's #general, like Slack, and a
 * company invites by email: the person keeps their one account (phone) and
 * joins the space when they verify that email in their profile.
 */
let mongo: MongoMemoryServer;
const codeService: AuthClient = {
  requestCode: () => Promise.resolve({ ok: true, valor: { canal: 'email' } }),
  verifyCode: () => Promise.resolve({ ok: true, valor: { secreto: 's' } }),
  validateDevice: () => Promise.resolve({ ok: true, valor: { companyId: 'constroad', identidad: 'x', app: 'lilachat' } }),
};
const app = buildApp({ authClient: codeService });
const users: Record<'jose' | 'ana' | 'beto' | 'luis', Types.ObjectId> = {} as never;
const jwt = (who: keyof typeof users) => `Bearer ${signSession({ userId: String(users[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), InvitationModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({}), WorkspaceEmailInviteModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  const created = await UserModel.create([
    { phone: '902049935', name: 'José Zamora' },
    { phone: '987654321', name: 'Ana Torres', email: 'ana@empresa.pe', emailVerifiedAt: new Date() },
    { phone: '976543210', name: 'Beto Ramos', email: 'beto@empresa.pe' },
    { phone: '954321098', name: 'Luis Huamán' },
  ]);
  [users.jose, users.ana, users.beto, users.luis] = created.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
});

async function createSpace(policy: 'open' | 'approval' = 'approval') {
  const res = await request(app).post('/api/workspaces').set('Authorization', jwt('jose')).send({ name: 'CONSTROAD', joinPolicy: policy }).expect(201);
  return res.body.workspace as { id: string; joinCode: string };
}
async function general(spaceId: string) {
  const space = await WorkspaceModel.findById(spaceId).lean();
  return space?.generalChatId ? ChatModel.findById(space.generalChatId).lean() : null;
}
const inGeneral = async (spaceId: string) => ((await general(spaceId))?.members ?? []).map((member) => String(member.userId)).sort();
const joinNotices = async (spaceId: string) => {
  const chat = await general(spaceId);
  return (await MessageModel.find({ chatId: chat?._id, 'system.evento': 'se-unio-espacio' }).sort({ seq: 1 }).lean()).map((message) => message.body);
};
const memberOf = (spaceId: string, who: keyof typeof users) => WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId: users[who] }).lean();

describe('#general (José, 22/10)', () => {
  it('a new space is born with #general and its owner inside; it shows as a joined public channel', async () => {
    const space = await createSpace();
    const chat = await general(space.id);
    expect(chat).toMatchObject({ name: 'general', channel: { visibility: 'public' } });
    expect(await inGeneral(space.id)).toEqual([String(users.jose)]);
    const channels = await request(app).get(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('jose')).expect(200);
    expect(channels.body.channels).toEqual([expect.objectContaining({ name: 'general', joined: true, members: 1 })]);
  });

  it('joining an open space puts the person in #general with «se unió al espacio»', async () => {
    const space = await createSpace('open');
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    expect(await inGeneral(space.id)).toEqual([String(users.jose), String(users.ana)].sort());
    expect(await joinNotices(space.id)).toEqual(['Ana Torres se unió al espacio']);
  });

  it('a request waits: #general and the notice come with the approval', async () => {
    const space = await createSpace('approval');
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    expect(await inGeneral(space.id)).toEqual([String(users.jose)]);
    const member = await memberOf(space.id, 'ana');
    await request(app).patch(`/api/workspaces/${space.id}/members/${member!._id}`).set('Authorization', jwt('jose')).send({ status: 'active' }).expect(200);
    expect(await inGeneral(space.id)).toContain(String(users.ana));
    expect(await joinNotices(space.id)).toEqual(['Ana Torres se unió al espacio']);
  });

  it('added by phone (with an account) or claimed when the phone signs up: both arrive', async () => {
    const space = await createSpace();
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201);
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '911222333' }).expect(201);
    const newcomer = await UserModel.create({ phone: '911222333', name: 'Rosa Quispe' });
    await claimPhoneInvites(newcomer._id, '911222333');
    expect(await inGeneral(space.id)).toEqual([String(users.jose), String(users.ana), String(newcomer._id)].sort());
    expect(await joinNotices(space.id)).toEqual(['Ana Torres se unió al espacio', 'Rosa Quispe se unió al espacio']);
  });

  it('a space from before #general gets it on the first look, with everyone active and no notices', async () => {
    const space = await createSpace();
    await ChatModel.deleteMany({ workspaceId: space.id });
    await WorkspaceModel.updateOne({ _id: space.id }, { $unset: { generalChatId: 1 } });
    await WorkspaceMemberModel.create({ workspaceId: space.id, userId: users.ana, phone: '987654321', role: 'member', status: 'active', joinedAt: new Date() });
    const channels = await request(app).get(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('ana')).expect(200);
    expect(channels.body.channels).toEqual([expect.objectContaining({ name: 'general', joined: true, members: 2 })]);
    expect(await joinNotices(space.id)).toEqual([]);
  });

  it('reactivating someone does not announce them again', async () => {
    const space = await createSpace();
    const ana = (await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201)).body.member;
    await request(app).patch(`/api/workspaces/${space.id}/members/${ana.id}`).set('Authorization', jwt('jose')).send({ status: 'deactivated' }).expect(200);
    expect(await inGeneral(space.id)).toEqual([String(users.jose)]);
    await request(app).patch(`/api/workspaces/${space.id}/members/${ana.id}`).set('Authorization', jwt('jose')).send({ status: 'active' }).expect(200);
    expect(await inGeneral(space.id)).toContain(String(users.ana));
    expect(await joinNotices(space.id)).toEqual(['Ana Torres se unió al espacio']);
  });
});

describe('inviting by email (José, 22/10: one account per person)', () => {
  const invite = (spaceId: string, body: object, who: keyof typeof users = 'jose') => request(app).post(`/api/workspaces/${spaceId}/invites`).set('Authorization', jwt(who)).send(body);

  it('an email without an account stays invited; verifying it in the profile joins the space and #general', async () => {
    const space = await createSpace();
    expect((await invite(space.id, { email: ' Luis@Empresa.pe ', area: 'Flota' }).expect(201)).body).toMatchObject({ status: 'invited', email: 'luis@empresa.pe' });
    const invited = await request(app).get(`/api/workspaces/${space.id}/members?status=invited`).set('Authorization', jwt('jose')).expect(200);
    expect(invited.body.members).toEqual([expect.objectContaining({ email: 'luis@empresa.pe', status: 'invited', area: 'Flota' })]);

    await request(app).post('/api/me/email/verify').set('Authorization', jwt('luis')).send({ email: 'luis@empresa.pe', code: '123456' }).expect(200);
    expect(await memberOf(space.id, 'luis')).toMatchObject({ status: 'active', area: 'Flota', phone: '954321098' });
    expect(await inGeneral(space.id)).toContain(String(users.luis));
    expect(await joinNotices(space.id)).toEqual(['Luis Huamán se unió al espacio']);
    expect(await WorkspaceEmailInviteModel.countDocuments({})).toBe(0);
  });

  it('an email a verified account already owns joins at once', async () => {
    const space = await createSpace();
    expect((await invite(space.id, { email: 'ana@empresa.pe' }).expect(201)).body).toMatchObject({ status: 'active' });
    expect(await memberOf(space.id, 'ana')).toMatchObject({ status: 'active' });
    expect(await joinNotices(space.id)).toEqual(['Ana Torres se unió al espacio']);
  });

  it('an unverified email does not join anyone; a deactivated person is not let back in by an email', async () => {
    const space = await createSpace();
    expect((await invite(space.id, { email: 'beto@empresa.pe' }).expect(201)).body).toMatchObject({ status: 'invited' });
    expect(await memberOf(space.id, 'beto')).toBeNull();

    const ana = (await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201)).body.member;
    await request(app).patch(`/api/workspaces/${space.id}/members/${ana.id}`).set('Authorization', jwt('jose')).send({ status: 'deactivated' }).expect(200);
    await invite(space.id, { email: 'ana@empresa.pe' }).expect(409);
    expect(await memberOf(space.id, 'ana')).toMatchObject({ status: 'deactivated' });
  });

  it('only admins invite, a malformed email is refused, and an invite can be withdrawn', async () => {
    const space = await createSpace('open');
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    await invite(space.id, { email: 'luis@empresa.pe' }, 'ana').expect(403);
    await invite(space.id, { email: 'no-es-correo' }).expect(400);
    const sent = (await invite(space.id, { email: 'luis@empresa.pe' }).expect(201)).body;
    await request(app).delete(`/api/workspaces/${space.id}/invites/${sent.id}`).set('Authorization', jwt('jose')).expect(204);
    await request(app).post('/api/me/email/verify').set('Authorization', jwt('luis')).send({ email: 'luis@empresa.pe', code: '123456' }).expect(200);
    expect(await memberOf(space.id, 'luis')).toBeNull();
  });
});
