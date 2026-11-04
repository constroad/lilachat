import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isRealPhone } from '@lilachat/shared';
import type { AuthClient, AuthOutcome } from '../src/authClient.js';
import { buildApp } from '../src/app.js';
import { DeviceModel, UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { startTestMongo } from '../src/testMongo.js';
import { WorkspaceEmailInviteModel, WorkspaceMemberModel, WorkspaceModel } from '../src/workspaceModels.js';

/** Sign-in by email (spec INGRESO-POR-ESPACIO): the code proves the inbox, and the account is the one that owns it. */
const EMAIL = 'ana.torres@constroad.com';
const DEVICE = 'device-email-1';

type Requested = string[];

function fakeAuth(overrides: Partial<AuthClient> = {}): { client: AuthClient; requested: Requested } {
  const requested: Requested = [];
  const ok = <T>(valor: T): Promise<AuthOutcome<T>> => Promise.resolve({ ok: true, valor });
  const client: AuthClient = {
    requestCode: (target) => {
      requested.push(target);
      return ok({ canal: 'email' });
    },
    verifyCode: () => ok({ secreto: 'device-secret-123' }),
    validateDevice: () => ok({ companyId: 'constroad', identidad: EMAIL, app: 'lilachat' }),
    ...overrides,
  };
  return { client, requested };
}

const verify = (client: AuthClient, body: Record<string, unknown> = {}) =>
  request(buildApp({ authClient: client })).post('/api/auth/email/verify').send({ email: EMAIL, code: '123456', deviceId: DEVICE, ...body });

const jwtOf = (userId: Types.ObjectId) => signSession({ userId: String(userId), deviceId: DEVICE, email: EMAIL });

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({}), WorkspaceEmailInviteModel.deleteMany({})]);
});

describe('POST /api/auth/email/request', () => {
  it('asks the service for a code to that email, normalized', async () => {
    const { client, requested } = fakeAuth();
    const response = await request(buildApp({ authClient: client })).post('/api/auth/email/request').send({ email: '  Ana.Torres@Constroad.com ' });
    expect(response.status).toBe(200);
    expect(requested).toEqual([EMAIL]);
  });

  it('refuses what is not an email without calling the service', async () => {
    const { client, requested } = fakeAuth();
    const response = await request(buildApp({ authClient: client })).post('/api/auth/email/request').send({ email: 'ana' });
    expect(response.status).toBe(400);
    expect(requested).toEqual([]);
  });

  it('answers the same whether the email has an account or the service fails', async () => {
    await UserModel.create({ phone: '902049935', email: EMAIL, emailVerifiedAt: new Date() });
    const known = await request(buildApp({ authClient: fakeAuth().client })).post('/api/auth/email/request').send({ email: EMAIL });
    const failing = fakeAuth({ requestCode: () => Promise.resolve({ ok: false, codigo: 'limitado' }) }).client;
    const unknown = await request(buildApp({ authClient: failing })).post('/api/auth/email/request').send({ email: 'otro@constroad.com' });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });
});

describe('POST /api/auth/email/verify', () => {
  it('a new email gets an account with an internal key and the email already proved', async () => {
    const response = await verify(fakeAuth().client);
    expect(response.status).toBe(200);
    const user = await UserModel.findById(response.body.user.id).lean();
    expect(user?.email).toBe(EMAIL);
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(isRealPhone(user?.phone)).toBe(false);
    expect(response.body.deviceSecret).toBe('device-secret-123');
    expect(await DeviceModel.exists({ deviceId: DEVICE, userId: user?._id })).toBeTruthy();
  });

  it('the second sign-in enters the same account', async () => {
    const first = await verify(fakeAuth().client);
    const second = await verify(fakeAuth().client, { deviceId: 'device-email-2' });
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(await UserModel.countDocuments({})).toBe(1);
  });

  it('an account that verified that email enters with its phone intact', async () => {
    const owner = await UserModel.create({ phone: '902049935', email: EMAIL, emailVerifiedAt: new Date(), name: 'Ana' });
    const response = await verify(fakeAuth().client);
    expect(response.body.user.id).toBe(String(owner._id));
    expect(response.body.user.phone).toBe('902049935');
  });

  it('an email held unverified admits nobody: it moves to whoever proved it', async () => {
    const holder = await UserModel.create({ phone: '902049935', email: EMAIL });
    const response = await verify(fakeAuth().client);
    expect(response.body.user.id).not.toBe(String(holder._id));
    expect((await UserModel.findById(holder._id).lean())?.email).toBeUndefined();
  });

  it('a wrong code creates nothing', async () => {
    const response = await verify(fakeAuth({ verifyCode: () => Promise.resolve({ ok: false, codigo: 'codigo_invalido' }) }).client);
    expect(response.status).toBe(401);
    expect(await UserModel.countDocuments({})).toBe(0);
  });

  it('a service that does not answer is a retry, not a wrong code', async () => {
    const response = await verify(fakeAuth({ verifyCode: () => Promise.resolve({ ok: false, codigo: 'sin_respuesta' }) }).client);
    expect(response.status).toBe(503);
  });

  it('a missing field is a 400 before the service', async () => {
    const response = await verify(fakeAuth().client, { deviceId: '' });
    expect(response.status).toBe(400);
  });

  it('the web keeps the secret in the cookie, never in the body', async () => {
    const response = await verify(fakeAuth().client, { cliente: 'web' });
    expect(response.body.deviceSecret).toBeUndefined();
    expect(String(response.headers['set-cookie'])).toContain('device-secret-123');
  });

  it('a new account only owes its name: the birthday belongs to the phone accounts', async () => {
    const { body } = await verify(fakeAuth().client);
    const profile = await request(buildApp({})).get('/api/me/profile').set('authorization', `Bearer ${body.jwt}`);
    expect(profile.body.profile.missing).toEqual(['name']);
  });
});

describe('Invitations of a verified email', () => {
  const app = () => buildApp({ authClient: fakeAuth().client });
  const inviter = new Types.ObjectId();

  async function invitedAccount() {
    const { body } = await verify(fakeAuth().client);
    await UserModel.updateOne({ _id: body.user.id }, { $set: { name: 'Ana Torres' } });
    const boss = await UserModel.create({ _id: inviter, phone: '987654321', name: 'Darío Paredes' });
    const workspace = await WorkspaceModel.create({ name: 'CONSTROAD', joinCode: 'ABC123', createdBy: boss._id, ownerId: boss._id, joinPolicy: 'open' });
    const invite = await WorkspaceEmailInviteModel.create({ workspaceId: workspace._id, email: EMAIL, addedBy: boss._id, title: 'Asistente' });
    return { jwt: body.jwt as string, userId: new Types.ObjectId(body.user.id as string), workspace, invite };
  }

  it('signing in does not join by itself: the invitation waits for «Unirme»', async () => {
    const { jwt, workspace, invite } = await invitedAccount();
    const response = await request(app()).get('/api/workspaces/invitations').set('authorization', `Bearer ${jwt}`);
    expect(response.body.invitations).toEqual([
      { id: String(invite._id), workspace: { id: String(workspace._id), name: 'CONSTROAD' }, invitedBy: 'Darío Paredes' },
    ]);
    expect(await WorkspaceMemberModel.countDocuments({ workspaceId: workspace._id })).toBe(0);
  });

  it('«Unirme» makes an active member with what the admin filled in, and the invitation goes away', async () => {
    const { jwt, userId, workspace, invite } = await invitedAccount();
    const response = await request(app()).post(`/api/workspaces/invitations/${invite._id}/accept`).set('authorization', `Bearer ${jwt}`);
    expect(response.status).toBe(200);
    expect(response.body.workspaceId).toBe(String(workspace._id));
    const member = await WorkspaceMemberModel.findOne({ workspaceId: workspace._id, userId }).lean();
    expect(member).toMatchObject({ status: 'active', title: 'Asistente' });
    expect(await WorkspaceEmailInviteModel.countDocuments({})).toBe(0);
  });

  it('nobody accepts the invitation of another email', async () => {
    const { invite } = await invitedAccount();
    const other = await UserModel.create({ phone: '911111111', email: 'otro@constroad.com', emailVerifiedAt: new Date() });
    const response = await request(app()).post(`/api/workspaces/invitations/${invite._id}/accept`).set('authorization', `Bearer ${jwtOf(other._id)}`);
    expect(response.status).toBe(404);
    expect(await WorkspaceEmailInviteModel.countDocuments({})).toBe(1);
  });

  it('an unverified email sees no invitations', async () => {
    const { invite } = await invitedAccount();
    await UserModel.updateOne({ email: EMAIL }, { $unset: { email: 1 } });
    const holder = await UserModel.create({ phone: '922222222', email: EMAIL });
    const response = await request(app()).get('/api/workspaces/invitations').set('authorization', `Bearer ${jwtOf(holder._id)}`);
    expect(response.body.invitations).toEqual([]);
    expect(await WorkspaceEmailInviteModel.exists({ _id: invite._id })).toBeTruthy();
  });

  it('an id that is not one answers 404, not a crash', async () => {
    const { jwt } = await invitedAccount();
    const response = await request(app()).post('/api/workspaces/invitations/nope/accept').set('authorization', `Bearer ${jwt}`);
    expect(response.status).toBe(404);
  });

  it('someone an admin deactivated stays out, and the invitation does not stay stuck', async () => {
    const { jwt, userId, workspace, invite } = await invitedAccount();
    const user = await UserModel.findById(userId).lean();
    await WorkspaceMemberModel.create({ workspaceId: workspace._id, userId, phone: user!.phone, role: 'member', status: 'deactivated', addedBy: inviter });
    const response = await request(app()).post(`/api/workspaces/invitations/${invite._id}/accept`).set('authorization', `Bearer ${jwt}`);
    expect(response.status).toBe(409);
    expect(await WorkspaceEmailInviteModel.countDocuments({})).toBe(0);
  });
});
