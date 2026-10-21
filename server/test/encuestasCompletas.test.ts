import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { PollModel } from '../src/eventModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/**
 * Encuestas completas (FL10, auditoría §46.3): no decían de qué chat ni quién
 * preguntó, nunca mostraban quién votó, «anónimo» no era real (el server
 * mandaba los votantes a todos), no se cerraban ni se borraban, y dos votos a
 * la vez podían pisarse (se reescribía la encuesta entera).
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let chatId: string;
let directoId: string;
const tokenDe = (userId: Types.ObjectId) => signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' });
const app = () => buildApp();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_encuestas_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), PollModel.deleteMany({}), UserModel.deleteMany({})]);
  const [a, b] = await UserModel.create([
    { phone: '900000001', name: 'José' },
    { phone: '900000002', name: 'María' },
  ]);
  jose = a!._id;
  maria = b!._id;
  const grupo = await ChatModel.create({
    kind: 'group',
    name: 'Familia',
    members: [{ userId: jose, role: 'admin' }, { userId: maria, role: 'member' }],
    lastSeq: 0,
  });
  chatId = String(grupo._id);
  const directo = await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: maria }], lastSeq: 0 });
  directoId = String(directo._id);
});

async function crear(cuerpo: Record<string, unknown>, autor = jose): Promise<string> {
  const respuesta = await request(app())
    .post('/api/agenda/polls')
    .set('Authorization', `Bearer ${tokenDe(autor)}`)
    .send({ chatId, question: '¿Playa o cine?', options: ['Playa', 'Cine'], ...cuerpo });
  expect(respuesta.status).toBe(201);
  return respuesta.body.id as string;
}

const votar = (pollId: string, quien: Types.ObjectId, optionIndex: number) =>
  request(app()).post(`/api/agenda/polls/${pollId}/vote`).set('Authorization', `Bearer ${tokenDe(quien)}`).send({ optionIndex });

type Vista = {
  id: string;
  chat: { kind: string; name?: string; phone?: string };
  autor: { id: string; phone: string; name?: string };
  esMia: boolean;
  options: { text: string; votes: string[] }[];
  personas: Record<string, { phone: string; name?: string }>;
};

async function listar(quien: Types.ObjectId): Promise<Vista[]> {
  const respuesta = await request(app()).get('/api/agenda/polls').set('Authorization', `Bearer ${tokenDe(quien)}`);
  expect(respuesta.status).toBe(200);
  return respuesta.body.polls as Vista[];
}

describe('encuestas: de dónde y de quién', () => {
  it('dice el chat y quién preguntó; «esMia» solo para el autor', async () => {
    await crear({});

    const [deMaria] = await listar(maria);
    const [deJose] = await listar(jose);

    expect(deMaria?.chat).toMatchObject({ kind: 'group', name: 'Familia' });
    expect(deMaria?.autor).toMatchObject({ id: String(jose), phone: '900000001', name: 'José' });
    expect(deMaria?.esMia).toBe(false);
    expect(deJose?.esMia).toBe(true);
  });

  it('en un 1:1 el chat es el otro: su teléfono, para la agenda', async () => {
    await crear({ chatId: directoId });

    const [deJose] = await listar(jose);

    expect(deJose?.chat).toMatchObject({ kind: 'direct', phone: '900000002', name: 'María' });
  });
});

describe('encuestas: quién votó', () => {
  it('con resultados visibles, los votantes vienen con su teléfono y nombre', async () => {
    const pollId = await crear({});
    await votar(pollId, maria, 1);

    const [deJose] = await listar(jose);

    expect(deJose?.options[1]?.votes).toEqual([String(maria)]);
    expect(deJose?.personas[String(maria)]).toEqual({ phone: '900000002', name: 'María' });
  });

  it('anónima de verdad: ningún id ajeno sale del server, pero los conteos sí', async () => {
    const pollId = await crear({ anonymous: true });
    await votar(pollId, jose, 0);
    await votar(pollId, maria, 1);

    const [deMaria] = await listar(maria);

    expect(JSON.stringify(deMaria?.options)).not.toContain(String(jose));
    expect(deMaria?.options.map((opcion) => opcion.votes.length)).toEqual([1, 1]);
    expect(deMaria?.options[1]?.votes).toEqual([String(maria)]);
    expect(deMaria?.personas[String(jose)]).toEqual({ phone: '900000001', name: 'José' });
    expect(Object.keys(deMaria?.personas ?? {})).toEqual([String(jose)]);
  });

  it('votar devuelve la encuesta ya actualizada', async () => {
    const pollId = await crear({});

    const respuesta = await votar(pollId, maria, 0);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.poll.options[0].votes).toEqual([String(maria)]);
  });

  it('votos simultáneos no se pisan', async () => {
    const otros = await UserModel.create(
      Array.from({ length: 6 }, (_, i) => ({ phone: `90000010${i}`, name: `Voto ${i}` }))
    );
    await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: otros.map((u) => ({ userId: u._id })) } } });
    const pollId = await crear({ allowMultiple: true });

    await Promise.all(otros.flatMap((u) => [votar(pollId, u._id, 0), votar(pollId, u._id, 1)]));

    const guardada = await PollModel.findById(pollId).lean();
    expect(guardada?.options[0]?.votes).toHaveLength(6);
    expect(guardada?.options[1]?.votes).toHaveLength(6);
  });

  it('con respuesta única el voto se mueve, aunque lleguen juntos', async () => {
    const pollId = await crear({});

    await Promise.all([votar(pollId, maria, 0), votar(pollId, jose, 1)]);
    await votar(pollId, maria, 1);

    const guardada = await PollModel.findById(pollId).lean();
    expect(guardada?.options[0]?.votes).toHaveLength(0);
    expect(guardada?.options[1]?.votes.map(String).sort()).toEqual([String(jose), String(maria)].sort());
  });
});

describe('encuestas: cerrar y eliminar', () => {
  it('solo quien la creó la cierra; cerrada no admite votos', async () => {
    const pollId = await crear({});
    const cerrar = (quien: Types.ObjectId) =>
      request(app()).post(`/api/agenda/polls/${pollId}/close`).set('Authorization', `Bearer ${tokenDe(quien)}`);

    expect((await cerrar(maria)).status).toBe(403);
    const cerrada = await cerrar(jose);
    const voto = await votar(pollId, maria, 0);

    expect(cerrada.status).toBe(200);
    expect(cerrada.body.poll.closedAt).toBeTruthy();
    expect(voto.status).toBe(400);
    expect(voto.body.message).toMatch(/cerró/);
  });

  it('solo quien la creó la elimina', async () => {
    const pollId = await crear({});
    const eliminar = (quien: Types.ObjectId) =>
      request(app()).delete(`/api/agenda/polls/${pollId}`).set('Authorization', `Bearer ${tokenDe(quien)}`);

    expect((await eliminar(maria)).status).toBe(403);
    expect((await eliminar(jose)).status).toBe(200);
    expect(await PollModel.countDocuments({})).toBe(0);
  });

  it('una que no existe es 404', async () => {
    const respuesta = await request(app())
      .delete(`/api/agenda/polls/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${tokenDe(jose)}`);

    expect(respuesta.status).toBe(404);
  });
});
