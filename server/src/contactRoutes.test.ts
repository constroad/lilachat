import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { ChatModel } from './chatModels.js';
import { InvitationModel, UserModel } from './models.js';
import { signSession } from './sessions.js';

/**
 * Contactos y creación de chats.
 *
 * Los contactos son **la familia invitada**, no «todos los usuarios»: en una
 * app de mensajería, una lista de contactos que incluye a cualquiera es un
 * directorio de teléfonos abierto.
 */
let mongo: MongoMemoryServer;
const app = buildApp();

const yo = new Types.ObjectId();
const mama = new Types.ObjectId();
const papa = new Types.ObjectId();
const jwt = signSession({ userId: String(yo), deviceId: 'd1', email: 'x' });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_contacts_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    ChatModel.deleteMany({}),
    UserModel.deleteMany({}),
    InvitationModel.deleteMany({}),
  ]);
  await UserModel.create([
    { _id: yo, phone: '902049935', name: 'José' },
    { _id: mama, phone: '999000111', name: 'Mamá' },
    { _id: papa, phone: '999000222', name: 'Álvaro' },
  ]);
  await InvitationModel.create([
    { phone: '902049935', email: 'jose@x.com', invitedBy: 'jose', status: 'invited' },
    { phone: '999000111', email: 'mama@x.com', invitedBy: 'jose', status: 'invited' },
    { phone: '999000222', email: 'papa@x.com', invitedBy: 'jose', status: 'invited' },
  ]);
});

describe('GET /api/contacts', () => {
  it('lista a la familia, agrupada y sin incluirme', async () => {
    const respuesta = await request(app).get('/api/contacts').set('Authorization', `Bearer ${jwt}`);

    expect(respuesta.status).toBe(200);
    const nombres = respuesta.body.groups.flatMap((grupo: { contacts: { name: string }[] }) =>
      grupo.contacts.map((contact) => contact.name)
    );
    expect(nombres).toContain('Mamá');
    // Yo no soy contacto mío: aparecer en mi propia lista invita a abrir un
    // chat conmigo mismo.
    expect(nombres).not.toContain('José');
    // «Álvaro» va bajo la A, no bajo «Á».
    expect(respuesta.body.groups[0]?.letter).toBe('A');
  });

  /** Alguien que no está invitado NO es contacto de nadie. */
  it('un usuario sin invitación no aparece', async () => {
    const colado = new Types.ObjectId();
    await UserModel.create({ _id: colado, phone: '911111111', name: 'Colado' });
    // Sin invitación: existe como usuario pero no es de la familia.

    const respuesta = await request(app).get('/api/contacts').set('Authorization', `Bearer ${jwt}`);

    const nombres = JSON.stringify(respuesta.body);
    expect(nombres).not.toContain('Colado');
  });

  /** Si ya hay chat 1:1, la lista lo dice: abrir en vez de crear. */
  it('marca con quién ya tengo conversación', async () => {
    const chat = await ChatModel.create({
      kind: 'direct',
      lastSeq: 0,
      members: [{ userId: yo }, { userId: mama }],
    });

    const respuesta = await request(app).get('/api/contacts').set('Authorization', `Bearer ${jwt}`);
    const todos = respuesta.body.groups.flatMap(
      (grupo: { contacts: { name: string; directChatId: string | null }[] }) => grupo.contacts
    );

    expect(todos.find((c: { name: string }) => c.name === 'Mamá').directChatId).toBe(
      String(chat._id)
    );
    expect(todos.find((c: { name: string }) => c.name === 'Álvaro').directChatId).toBeNull();
  });

  it('sin sesión, 401', async () => {
    expect((await request(app).get('/api/contacts')).status).toBe(401);
  });
});

describe('POST /api/chats — el 1:1 no se duplica', () => {
  /**
   * Tocar dos veces a la misma persona desde «nuevo chat» tiene que llevar a la
   * MISMA conversación. Sin esto, los mensajes quedan repartidos entre dos
   * chats con la misma persona y no hay forma de juntarlos después.
   */
  it('crear dos veces el mismo directo devuelve el mismo chat', async () => {
    const primero = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ kind: 'direct', memberIds: [String(mama)] });

    const segundo = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ kind: 'direct', memberIds: [String(mama)] });

    expect(primero.status).toBe(201);
    expect(segundo.body.chatId).toBe(primero.body.chatId);
    expect(await ChatModel.countDocuments({ kind: 'direct' })).toBe(1);
  });

  /** Los grupos SÍ se repiten: dos grupos con la misma gente son legítimos. */
  it('un grupo con los mismos miembros se crea igual', async () => {
    const uno = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ kind: 'group', name: 'Cumpleaños', memberIds: [String(mama), String(papa)] });

    const dos = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ kind: 'group', name: 'Viaje', memberIds: [String(mama), String(papa)] });

    expect(dos.body.chatId).not.toBe(uno.body.chatId);
    expect(await ChatModel.countDocuments({ kind: 'group' })).toBe(2);
  });

  /** Un grupo sin nombre no es usable: la lista lo mostraría sin título. */
  it('un grupo exige nombre', async () => {
    const respuesta = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ kind: 'group', memberIds: [String(mama), String(papa)] });

    expect(respuesta.status).toBe(400);
  });
});
