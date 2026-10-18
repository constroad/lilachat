import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { EventModel } from '../src/eventModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/**
 * El evento completo (FL10, auditoría §46.3): quien no lo creó no veía
 * quiénes van ni en qué chat, y «Pueden invitar a otros» no tenía efecto.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let pedro: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: string;
const tokenDe = (userId: Types.ObjectId) => signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' });
const app = () => buildApp();
const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_eventos_completos_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), EventModel.deleteMany({}), UserModel.deleteMany({})]);
  const usuarios = await UserModel.create([
    { phone: '900000001', name: 'José' },
    { phone: '900000002', name: 'María' },
    { phone: '900000003', name: 'Pedro' },
    { phone: '900000004', name: 'Ajeno' },
  ]);
  [jose, maria, pedro, ajeno] = usuarios.map((u) => u._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const grupo = await ChatModel.create({
    kind: 'group',
    name: 'Familia',
    members: [{ userId: jose, role: 'admin' }, { userId: maria }],
    lastSeq: 0,
  });
  chatId = String(grupo._id);
  // Pedro es contacto de María (un 1:1), pero no está en «Familia».
  await ChatModel.create({ kind: 'direct', members: [{ userId: maria }, { userId: pedro }], lastSeq: 0 });
});

async function crearEvento(extra: Record<string, unknown> = {}): Promise<string> {
  const respuesta = await request(app())
    .post('/api/agenda/events')
    .set('Authorization', `Bearer ${tokenDe(jose)}`)
    .send({ chatId, title: 'Almuerzo', startsAt: enUnaHora(), ...extra });
  expect(respuesta.status).toBe(201);
  return respuesta.body.id as string;
}

type Vista = {
  id: string;
  chat?: { kind: string; name?: string };
  personas: Record<string, { phone: string; name?: string }>;
  attendees: { userId: string; rsvp?: string; invitedBy?: string }[];
  puedoInvitar: boolean;
  guestsCanInvite: boolean;
};

async function eventosDe(quien: Types.ObjectId): Promise<Vista[]> {
  const respuesta = await request(app()).get('/api/agenda/events').set('Authorization', `Bearer ${tokenDe(quien)}`);
  expect(respuesta.status).toBe(200);
  return respuesta.body.events as Vista[];
}

const invitar = (eventId: string, quien: Types.ObjectId, userIds: Types.ObjectId[]) =>
  request(app())
    .post(`/api/agenda/events/${eventId}/invitar`)
    .set('Authorization', `Bearer ${tokenDe(quien)}`)
    .send({ userIds: userIds.map(String) });

describe('evento: el detalle para quien no lo creó', () => {
  it('dice el chat y nombra a quien lo creó y a los invitados', async () => {
    await crearEvento();

    const [deMaria] = await eventosDe(maria);

    expect(deMaria?.chat).toMatchObject({ kind: 'group', name: 'Familia' });
    expect(deMaria?.personas[String(jose)]).toEqual({ phone: '900000001', name: 'José' });
    expect(deMaria?.personas[String(maria)]).toEqual({ phone: '900000002', name: 'María' });
    expect(deMaria?.attendees.map((a) => a.userId).sort()).toEqual([String(jose), String(maria)].sort());
  });
});

describe('evento: «Pueden invitar a otros»', () => {
  it('apagado: solo quien lo creó invita', async () => {
    const eventId = await crearEvento();

    const [deMaria] = await eventosDe(maria);
    const [deJose] = await eventosDe(jose);

    expect(deMaria?.puedoInvitar).toBe(false);
    expect(deJose?.puedoInvitar).toBe(true);
    expect((await invitar(eventId, maria, [pedro])).status).toBe(403);
  });

  it('encendido: un invitado suma a un contacto suyo, que ve el evento sin ver el chat y puede responder', async () => {
    const eventId = await crearEvento({ guestsCanInvite: true });

    const respuesta = await invitar(eventId, maria, [pedro]);
    const [dePedro] = await eventosDe(pedro);
    const rsvp = await request(app())
      .post(`/api/agenda/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${tokenDe(pedro)}`)
      .send({ rsvp: 'yes' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.agregados).toBe(1);
    expect(dePedro?.id).toBe(eventId);
    expect(dePedro?.chat).toBeUndefined();
    expect(dePedro?.attendees.find((a) => a.userId === String(pedro))?.invitedBy).toBe(String(maria));
    expect(rsvp.status).toBe(200);
  });

  it('a un desconocido (sin chat en común) no se lo invita', async () => {
    const eventId = await crearEvento({ guestsCanInvite: true });

    const respuesta = await invitar(eventId, maria, [ajeno]);
    const guardado = await EventModel.findById(eventId).lean();

    expect(respuesta.status).toBe(400);
    expect(guardado?.attendees.some((a) => a.userId.equals(ajeno))).toBe(false);
  });

  it('invitar a quien ya está no lo duplica', async () => {
    const eventId = await crearEvento();

    const respuesta = await invitar(eventId, jose, [maria]);
    const guardado = await EventModel.findById(eventId).lean();

    expect(respuesta.body.agregados).toBe(0);
    expect(guardado?.attendees).toHaveLength(2);
  });

  it('alguien que no ve el evento no invita', async () => {
    const eventId = await crearEvento({ guestsCanInvite: true });

    expect((await invitar(eventId, ajeno, [jose])).status).toBe(404);
  });
});
