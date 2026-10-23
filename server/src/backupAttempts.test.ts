import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { huellaDeBytes } from '@lilachat/shared';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { RespaldoModel } from './respaldoModels.js';
import { BackupAttemptModel } from './backupAttempts.js';
import { MARCA_DEL_DISCO } from './respaldoDisco.js';
import { signSession } from './sessions.js';

/**
 * Pending 83 (lila-2, 23/10): the `respaldos` collection was at zero and nobody
 * could tell «nobody created a key» from «everybody got 507», because the 507
 * answers before writing anything. Every attempt now counts, by reason.
 */
let mongo: MongoMemoryServer;
let root: string;
let creator: Types.ObjectId;
let stranger: Types.ObjectId;
const app = buildApp();
const jwtOf = (userId: Types.ObjectId) => `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: String(userId) })}`;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_backup_attempts'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lilachat-attempts-'));
  process.env.RESPALDOS_RAIZ = root;
  await writeFile(path.join(root, MARCA_DEL_DISCO), '');
  await Promise.all([UserModel.deleteMany({}), RespaldoModel.deleteMany({}), BackupAttemptModel.deleteMany({})]);
  const [first, second] = await UserModel.create([
    { phone: '51902049935', name: 'José', email: 'jose@example.com', emailVerifiedAt: new Date() },
    { phone: '51900000031', name: 'Sin correo' },
  ]);
  creator = first!._id;
  stranger = second!._id;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const upload = (who: Types.ObjectId, body = Buffer.from('respaldo')) =>
  request(app).put('/api/respaldos').set('Authorization', jwtOf(who)).set('Content-Type', 'application/octet-stream').set('x-huella', huellaDeBytes(body)).set('x-nombre', 'r.lcb').send(body);

const attempts = async () => (await request(app).get('/api/respaldos/intentos').set('Authorization', jwtOf(creator))).body;

describe('backup attempts counted by reason (pending 83)', () => {
  it('a 507 without disk, a refusal for the email and a saved backup each leave their count', async () => {
    await rm(path.join(root, MARCA_DEL_DISCO));
    await upload(creator).expect(507);
    await upload(stranger).expect(403);
    await writeFile(path.join(root, MARCA_DEL_DISCO), '');
    await upload(creator).expect(201);
    const { reasons } = await attempts();
    expect(reasons).toEqual(expect.arrayContaining([
      { reason: 'disco_ausente', count: 1, users: 1 },
      { reason: 'correo_sin_verificar', count: 1, users: 1 },
      { reason: 'guardado', count: 1, users: 1 },
    ]));
  });

  it('the phone reports «no key yet»; the same person twice is one person', async () => {
    for (let i = 0; i < 2; i += 1) {
      await request(app).post('/api/respaldos/intento').set('Authorization', jwtOf(stranger)).send({ motivo: 'sin_passphrase' }).expect(204);
    }
    expect((await attempts()).reasons).toEqual([{ reason: 'sin_passphrase', count: 2, users: 1 }]);
  });

  it('the phone cannot invent reasons, and only the creator or an operator reads the counts', async () => {
    await request(app).post('/api/respaldos/intento').set('Authorization', jwtOf(stranger)).send({ motivo: 'cualquier_cosa' }).expect(400);
    await request(app).get('/api/respaldos/intentos').set('Authorization', jwtOf(stranger)).expect(403);
  });
});
