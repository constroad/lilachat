import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { contentDisposition } from './backupRoutes.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { UserModel } from './models.js';
import { signSession } from './sessions.js';

/**
 * Export y estado del respaldo (F7).
 *
 * El export es la pieza con más filo de toda la fase: devuelve la conversación
 * ENTERA en un solo request. Si el permiso se equivoca, no se filtra un dato
 * suelto — se filtra un chat completo.
 */
let mongo: MongoMemoryServer;
const app = buildApp();

const yo = new Types.ObjectId();
const otro = new Types.ObjectId();
const extraño = new Types.ObjectId();
const jwtDe = (userId: Types.ObjectId) =>
  signSession({ userId: String(userId), deviceId: `d-${userId}`, email: '+51902049935' });

let chatId: Types.ObjectId;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({})]);
  await UserModel.create([
    { _id: yo, phone: '902049935', name: 'José' },
    { _id: otro, phone: '999000333', name: 'Mamá' },
  ]);
  const chat = await ChatModel.create({
    kind: 'group',
    name: 'Familia',
    lastSeq: 2,
    members: [{ userId: yo }, { userId: otro }],
  });
  chatId = chat._id;
  await MessageModel.create([
    {
      chatId,
      seq: 1,
      senderId: otro,
      kind: 'text',
      body: '¿Vienes el domingo?',
      clientKey: 'k1',
      at: new Date('2026-08-24T12:00:00Z'),
    },
    {
      chatId,
      seq: 2,
      senderId: yo,
      kind: 'text',
      body: 'Ahí estaré',
      clientKey: 'k2',
      at: new Date('2026-08-24T12:01:00Z'),
    },
    {
      chatId,
      seq: 3,
      senderId: otro,
      kind: 'image',
      clientKey: 'k3',
      at: new Date('2026-08-24T12:02:00Z'),
      media: { mediaId: 'm1', url: '/files/companies/constroad/apps/lilachat/foto.jpg' },
    },
  ]);
});

describe('GET /api/backup/export/:chatId', () => {
  it('devuelve la conversación con los nombres resueltos', async () => {
    const respuesta = await request(app)
      .get(`/api/backup/export/${chatId}`)
      .set('Authorization', `Bearer ${jwtDe(yo)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.chat.name).toBe('Familia');
    expect(respuesta.body.messages).toHaveLength(3);
    // Con `senderId` pelado el archivo es ilegible: quien abra el export dentro
    // de cinco años necesita el NOMBRE, no un ObjectId.
    expect(respuesta.body.messages[0].from).toBe('Mamá');
    expect(respuesta.body.messages[0].body).toBe('¿Vienes el domingo?');
  });

  /**
   * La fecha y la media salían MAL y nadie lo veía: el export leía
   * `message.createdAt` y `message.mediaUrl`, campos que este esquema no tiene
   * —son `at` y `media.url`—. El resultado era un export con todas las fechas
   * en `undefined` y las fotos siempre en `null`, y los tests no lo notaban
   * porque solo miraban `seq`, `from` y `body`.
   */
  it('cada mensaje sale con su FECHA y la foto con su URL', async () => {
    const respuesta = await request(app)
      .get(`/api/backup/export/${chatId}`)
      .set('Authorization', `Bearer ${jwtDe(yo)}`);

    expect(respuesta.body.messages[0].at).toBe('2026-08-24T12:00:00.000Z');
    const foto = respuesta.body.messages[2];
    expect(foto.kind).toBe('image');
    expect(foto.mediaUrl).toBe('/files/companies/constroad/apps/lilachat/foto.jpg');
  });

  it('sale ordenado por seq, que es el orden real de la conversación', async () => {
    const respuesta = await request(app)
      .get(`/api/backup/export/${chatId}`)
      .set('Authorization', `Bearer ${jwtDe(yo)}`);

    expect(respuesta.body.messages.map((m: { seq: number }) => m.seq)).toEqual([1, 2, 3]);
  });

  /**
   * LA prueba de la fase: la membresía es el permiso. Un extraño con sesión
   * válida no puede exportar un chat ajeno — y el error es el mismo que si el
   * chat no existiera, para no confirmar que existe.
   */
  it('un extraño con sesión válida NO puede exportar el chat', async () => {
    const respuesta = await request(app)
      .get(`/api/backup/export/${chatId}`)
      .set('Authorization', `Bearer ${jwtDe(extraño)}`);

    expect(respuesta.status).toBe(403);
    expect(JSON.stringify(respuesta.body)).not.toContain('Familia');
    expect(JSON.stringify(respuesta.body)).not.toContain('domingo');
  });

  it('sin sesión, 401', async () => {
    const respuesta = await request(app).get(`/api/backup/export/${chatId}`);

    expect(respuesta.status).toBe(401);
  });

  /** Un id con forma inválida no puede llegar a la consulta. */
  it('un chatId inválido no revienta el server', async () => {
    const respuesta = await request(app)
      .get('/api/backup/export/no-es-un-id')
      .set('Authorization', `Bearer ${jwtDe(yo)}`);

    expect(respuesta.status).toBe(403);
  });
});

describe('GET /api/backup', () => {
  it('informa el estado, y sin respaldos lo dice', async () => {
    process.env.BACKUP_DIR = '/tmp/lilachat-backups-inexistente';

    const respuesta = await request(app)
      .get('/api/backup')
      .set('Authorization', `Bearer ${jwtDe(yo)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.count).toBe(0);
    expect(respuesta.body.lastAt).toBeNull();
    // `stale` es lo que hace que la pantalla NO pinte un cartel verde sobre una
    // carpeta vacía.
    expect(respuesta.body.stale).toBe(true);
  });

  it('sin sesión, 401', async () => {
    expect((await request(app).get('/api/backup')).status).toBe(401);
  });
});

describe('contentDisposition', () => {
  /**
   * El caso que tumbó el server en el E2E.
   *
   * Un chat llamado «QA-F7 — borrar» (guion largo) hacía que Node rechazara la
   * cabecera y, por ser un handler async de Express 4, el throw se llevaba el
   * PROCESO ENTERO. Los tests no lo vieron porque el chat de prueba se llamaba
   * «Familia»: puro ASCII. Los nombres reales llevan tildes, guiones largos y
   * emojis — los datos de prueba tienen que parecerse a los de verdad.
   */
  it('un nombre con acentos y emoji produce una cabecera válida', () => {
    const header = contentDisposition('Familia ❤️ — Reunión');

    expect(() => new Headers({ 'Content-Disposition': header })).not.toThrow();
    expect(header).toMatch(/filename="lilachat-[\x20-\x7E]+\.json"/);
    // Y el nombre real sobrevive en la forma UTF-8.
    expect(header).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(header.split("UTF-8''")[1]!)).toContain('Reunión');
  });

  /** Un salto de línea en el nombre sería inyección de cabeceras. */
  it('no deja inyectar cabeceras', () => {
    const header = contentDisposition('malo"\r\nX-Inyectado: si');

    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
    expect(() => new Headers({ 'Content-Disposition': header })).not.toThrow();
  });

  it('un nombre vacío no deja el archivo sin nombre', () => {
    expect(contentDisposition('   ')).toContain('lilachat-conversacion.json');
  });
});
