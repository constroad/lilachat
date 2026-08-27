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

  /**
   * **Este test decía lo contrario hasta el 26/08/2026.**
   *
   * Mientras entrar exigía una invitación, un usuario sin ella era un colado y
   * no tenía por qué figurar. Con el REGISTRO ABIERTO —decisión de José: «todo
   * a público»— ya no hay colados: quien entró, entró, y no listarlo lo dejaría
   * en un lugar donde nadie lo ve ni le puede escribir.
   *
   * Se conserva el test invertido y no se borra: deja escrito que la regla
   * CAMBIÓ, y por qué. Si algún día se vuelve a cerrar el registro, acá está lo
   * que hay que volver a poner.
   */
  it('quien entró sin invitación TAMBIÉN es contacto', async () => {
    const nuevo = new Types.ObjectId();
    await UserModel.create({ _id: nuevo, phone: '911111111', name: 'Recién llegado' });

    const respuesta = await request(app).get('/api/contacts').set('Authorization', `Bearer ${jwt}`);

    expect(JSON.stringify(respuesta.body)).toContain('Recién llegado');
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

/**
 * Invitar CREA la admisión — el paso que faltaba.
 *
 * Wilson instaló Lilachat el 26/08/2026 y no le llegaba el código ni por
 * WhatsApp ni por correo. No era el envío: `POST /auth/otp/request` **no manda
 * nada** a un número sin admisión y contesta 200 igual, para no revelar quién
 * existe. El botón «Invitar» compartía el APK y no daba de alta a nadie, así que
 * la persona quedaba instalando una app en la que no podía entrar.
 */
describe('POST /api/contacts/invite', () => {
  it('crea la admisión, que es lo que habilita el código', async () => {
    const respuesta = await request(app)
      .post('/api/contacts/invite')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ phone: '+51 988 777 666' });

    expect(respuesta.status).toBe(201);
    const creada = await InvitationModel.findOne({ phone: '988777666' }).lean();
    expect(creada?.status).toBe('invited');
    expect(creada?.invitedBy).toBe(String(yo));
  });

  /** La agenda guarda el número con espacios y prefijo; se admite normalizado. */
  it('normaliza el número antes de guardarlo', async () => {
    await request(app)
      .post('/api/contacts/invite')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ phone: '988-777-666' });

    expect(await InvitationModel.countDocuments({ phone: '988777666' })).toBe(1);
  });

  /** Tocar «Invitar» dos veces no puede dejar dos filas. */
  it('invitar dos veces no duplica', async () => {
    for (const intento of [1, 2]) {
      void intento;
      await request(app)
        .post('/api/contacts/invite')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ phone: '988777666' });
    }

    expect(await InvitationModel.countDocuments({ phone: '988777666' })).toBe(1);
  });

  it('a quien ya es usuario no lo vuelve a invitar', async () => {
    const respuesta = await request(app)
      .post('/api/contacts/invite')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ phone: '999000111' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('ya-esta');
  });

  it('un número inválido se rechaza con motivo', async () => {
    const respuesta = await request(app)
      .post('/api/contacts/invite')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ phone: 'no soy un número' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toBeTruthy();
    expect(await InvitationModel.countDocuments({ phone: '' })).toBe(0);
  });

  /**
   * **La regla que sostiene todo lo demás.** Un endpoint abierto que crea
   * admisiones convierte el chat familiar en un registro público: cualquiera se
   * auto-invitaría y el gate anti-enumeración del OTP dejaría de significar nada.
   */
  it('sin sesión no se puede invitar a nadie', async () => {
    const respuesta = await request(app)
      .post('/api/contacts/invite')
      .send({ phone: '988777666' });

    expect(respuesta.status).toBe(401);
    expect(await InvitationModel.countDocuments({ phone: '988777666' })).toBe(0);
  });
});

/**
 * Con el REGISTRO ABIERTO, los contactos son los USUARIOS, no los invitados.
 *
 * Abrir el registro sin tocar esto dejaba a la gente entrando a un lugar donde
 * nadie la ve: la lista salía de `invitations`, y quien se registra solo no
 * tiene ninguna. Podría escribir a otros y nadie podría escribirle a él.
 *
 * **El precio, dicho con todas las letras:** la lista de contactos es ahora el
 * padrón completo. Cualquiera que entre ve el teléfono de todos los demás. Es la
 * consecuencia directa de que Lilachat sea pública, y se acepta a conciencia.
 */
describe('GET /api/contacts con registro abierto', () => {
  it('quien se registró SIN invitación igual aparece', async () => {
    const solo = new Types.ObjectId();
    await UserModel.create({ _id: solo, phone: '955444333', name: 'Wilson' });

    const respuesta = await request(app).get('/api/contacts').set('Authorization', `Bearer ${jwt}`);

    const nombres = respuesta.body.groups.flatMap((grupo: { contacts: { name: string }[] }) =>
      grupo.contacts.map((contacto) => contacto.name)
    );
    expect(nombres).toContain('Wilson');
  });

  /** Uno mismo nunca aparece en su propia lista de contactos. */
  it('yo no aparezco en mi propia lista', async () => {
    const respuesta = await request(app).get('/api/contacts').set('Authorization', `Bearer ${jwt}`);

    const telefonos = respuesta.body.groups.flatMap((grupo: { contacts: { phone: string }[] }) =>
      grupo.contacts.map((contacto) => contacto.phone)
    );
    expect(telefonos).not.toContain('902049935');
  });
});
