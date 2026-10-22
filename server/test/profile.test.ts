import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import type { AuthClient, AuthOutcome } from '../src/authClient.js';
import { buildApp } from '../src/app.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** José, 21/10: name, birthday and a verified email are mandatory (backlog 17). */
const sent: string[] = [];
const ok = <T>(valor: T): Promise<AuthOutcome<T>> => Promise.resolve({ ok: true, valor });
const authClient: AuthClient = {
  requestCode: (destino) => (sent.push(destino), ok({ canal: 'email' })),
  verifyCode: (_destino, code) => (code === '123456' ? ok({ secreto: 's' }) : Promise.resolve({ ok: false, codigo: 'codigo_invalido' } as never)),
  validateDevice: () => ok({ companyId: 'constroad', identidad: 'x', app: 'lilachat' }),
};
const app = buildApp({ authClient });
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(ana), deviceId: 'd-ana', email: 'x' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_profile'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  sent.length = 0;
  await UserModel.deleteMany({});
  ana = (await UserModel.create({ phone: '987654321', name: 'Ana' }))._id;
});

describe('my profile', () => {
  it('says what is missing', async () => {
    const profile = (await request(app).get('/api/me/profile').set(auth()).expect(200)).body.profile;
    expect(profile).toMatchObject({ name: 'Ana', phone: '987654321', emailVerified: false, missing: ['birthday', 'email'] });
  });

  it('saves the birthday and who sees it; a day the month does not have is refused', async () => {
    await request(app).put('/api/me/profile').set(auth()).send({ birthday: { day: 31, month: 4 } }).expect(400);
    const saved = (await request(app).put('/api/me/profile').set(auth()).send({ birthday: { day: 29, month: 8, year: 1990 }, birthdayVisible: false }).expect(200)).body.profile;
    expect(saved).toMatchObject({ birthday: { day: 29, month: 8, year: 1990 }, birthdayVisible: false, missing: ['email'] });
  });

  it('the email: a code to it, and verifying it saves it lowercased', async () => {
    await request(app).post('/api/me/email/code').set(auth()).send({ email: ' Ana@Example.COM ' }).expect(200);
    expect(sent).toEqual(['ana@example.com']);
    await request(app).post('/api/me/email/verify').set(auth()).send({ email: 'ana@example.com', code: '000000' }).expect(400);
    await request(app).post('/api/me/email/verify').set(auth()).send({ email: 'ana@example.com', code: '123456' }).expect(200);
    const user = await UserModel.findById(ana).lean();
    expect(user).toMatchObject({ email: 'ana@example.com' });
    expect(user!.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('an email that is already another account’s is refused before sending anything', async () => {
    await UserModel.create({ phone: '976543210', name: 'Beto', email: 'beto@example.com', emailVerifiedAt: new Date() });
    await request(app).post('/api/me/email/code').set(auth()).send({ email: 'beto@example.com' }).expect(409);
    expect(sent).toEqual([]);
  });

  it('an older account that only held the email unverified lets it go to who proves the code', async () => {
    const old = (await UserModel.create({ phone: '955555555', name: 'Vieja', email: 'ana@example.com' }))._id;
    await request(app).post('/api/me/email/verify').set(auth()).send({ email: 'ana@example.com', code: '123456' }).expect(200);
    expect((await UserModel.findById(old).lean())!.email).toBeUndefined();
    expect((await UserModel.findById(ana).lean())!.email).toBe('ana@example.com');
  });

  it('with the three, nothing is missing', async () => {
    await request(app).put('/api/me/profile').set(auth()).send({ birthday: { day: 29, month: 8 } }).expect(200);
    await request(app).post('/api/me/email/verify').set(auth()).send({ email: 'ana@example.com', code: '123456' }).expect(200);
    expect((await request(app).get('/api/me/profile').set(auth()).expect(200)).body.profile.missing).toEqual([]);
  });
});
