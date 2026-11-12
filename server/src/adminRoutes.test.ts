import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { signSession } from './sessions.js';

/**
 * José, 12/11/2026: «solo el super admin puede ver los usuarios que existen en
 * Lilachat». The users panel is the creator's alone; an operator of
 * `LILACHAT_OPERADORES` runs backups, never reads who is in Lilachat.
 */
let mongo: MongoMemoryServer;
const app = buildApp();
const people = {} as Record<'jose' | 'operator' | 'ana', Types.ObjectId>;
const jwt = (who: keyof typeof people) => `Bearer ${signSession({ userId: String(people[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
  const created = await UserModel.create([
    { phone: '902049935', name: 'José Zamora' },
    { phone: '999111222', name: 'Operador' },
    { phone: '987654321', name: 'Ana Torres' },
  ]);
  [people.jose, people.operator, people.ana] = created.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  process.env.LILACHAT_OPERADORES = '999111222';
});

afterEach(() => {
  delete process.env.LILACHAT_OPERADORES;
});

describe('the users panel', () => {
  it('is open to the creator', async () => {
    // Act
    const res = await request(app).get('/api/admin/users').set('Authorization', jwt('jose'));
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(3);
  });

  it('is closed to an operator and to anyone else, and Ajustes does not offer it to them', async () => {
    // Act
    const answers = await Promise.all([
      request(app).get('/api/admin/users').set('Authorization', jwt('operator')),
      request(app).get('/api/admin').set('Authorization', jwt('operator')),
      request(app).get('/api/admin/users').set('Authorization', jwt('ana')),
    ]);
    // Assert
    expect(answers.map((res) => res.status)).toEqual([403, 403, 403]);
  });
});
