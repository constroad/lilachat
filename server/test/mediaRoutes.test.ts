import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import type { MediaUploader, UploadOutcome } from '../src/mediaClient.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/**
 * La subida, con lila FALSO e inyectado: lo que se prueba es NUESTRO camino
 * —validación, membresía, el mensaje que queda— no el storage de ellos.
 */
type Call = { chatId: string; fileName: string; kind: string; bytes: number };

function fakeUploader(outcome?: UploadOutcome) {
  const calls: Call[] = [];
  const uploader: MediaUploader = {
    upload: async (params) => {
      calls.push({
        chatId: params.chatId,
        fileName: params.fileName,
        kind: params.kind,
        bytes: params.bytes.length,
      });
      return (
        outcome ?? {
          ok: true,
          media: {
            url: '/files/companies/constroad/apps/lilachat/x/image-1.jpg',
            thumbnailUrl: '/files/companies/constroad/apps/lilachat/x/.thumb/image-1.jpg',
            thumbnailStatus: 'ready',
            sizeBytes: params.bytes.length,
            storageName: 'image-1.jpg',
          },
        }
      );
    },
  };
  return { uploader, calls };
}

let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: string;
let token: string;

beforeAll(async () => {
  // Declarado acá y no heredado del entorno: un test que depende de una
  // variable ambiente pasa en una máquina y falla en otra.
  process.env.LILA_PUBLIC_URL = 'https://lila.constroad.com';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_media_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '900000001', email: 'jose@x.com' }, { phone: '900000003', email: 'ajeno@x.com' }]);
  [jose, ajeno] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  const chat = await ChatModel.create({
    kind: 'direct',
    members: [{ userId: jose, role: 'admin' }],
    lastSeq: 0,
  });
  chatId = String(chat._id);
  token = signSession({ userId: String(jose), deviceId: 'd1', email: 'jose@x.com' });
});

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

describe('POST /api/media', () => {
  it('sube y deja UN mensaje de tipo image con su miniatura', async () => {
    const { uploader, calls } = fakeUploader();
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', chatId)
      .field('clientKey', 'ck-media-1')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatchObject({ kind: 'image', seq: 1 });
    expect(response.body.thumbnailUrl).toContain('.thumb');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ chatId, kind: 'image' });
    expect(await MessageModel.countDocuments({})).toBe(1);
  });

  /** La misma foto reenviada por la cola no puede duplicar el mensaje. */
  it('el mismo clientKey no crea un segundo mensaje', async () => {
    const { uploader } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const send = () =>
      request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .field('chatId', chatId)
        .field('clientKey', 'ck-media-1')
        .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    await send();
    const retry = await send();

    expect(retry.body.duplicate).toBe(true);
    expect(await MessageModel.countDocuments({})).toBe(1);
  });

  it('sin sesión no se sube nada', async () => {
    const { uploader, calls } = fakeUploader();
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .field('chatId', chatId)
      .field('clientKey', 'x')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  /**
   * El chat ajeno se rechaza DESPUÉS de subir (el mensaje es quien valida), así
   * que lo que se afirma es que no queda mensaje. El archivo huérfano es el
   * precio de un solo request; el caso es raro y no compensa un segundo viaje.
   */
  it('en un chat ajeno no queda mensaje', async () => {
    const { uploader } = fakeUploader();
    const ajenoToken = signSession({ userId: String(ajeno), deviceId: 'd2', email: 'ajeno@x.com' });
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${ajenoToken}`)
      .field('chatId', chatId)
      .field('clientKey', 'x')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(403);
    expect(await MessageModel.countDocuments({})).toBe(0);
  });

  it('un archivo enorme se rechaza con 413 y sin llamar a lila', async () => {
    const { uploader, calls } = fakeUploader();
    const huge = Buffer.alloc(26 * 1024 * 1024, 1);
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', chatId)
      .field('clientKey', 'x')
      .attach('file', huge, { filename: 'gigante.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  /** Storage caído ≠ archivo inválido: uno se reintenta, el otro se descarta. */
  it('lila sin responder da 503 (reintentable), no 502', async () => {
    const { uploader } = fakeUploader({ ok: false, codigo: 'sin_respuesta' });
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', chatId)
      .field('clientKey', 'x')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(503);
    expect(await MessageModel.countDocuments({})).toBe(0);
  });

  it('lila rechazando el archivo da 502, que NO se reintenta', async () => {
    const { uploader } = fakeUploader({ ok: false, codigo: 'rechazado', message: 'Invalid file name' });
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', chatId)
      .field('clientKey', 'x')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(502);
  });
});

describe('URLs de media hacia el cliente', () => {
  /**
   * Se PERSISTE relativa y se resuelve al servir. Guardar la absoluta rompe
   * todos los mensajes viejos el día que cambia el hosting — ya pasó en Portal,
   * con `localhost` persistido en producción.
   */
  it('la base guarda la relativa; el socket y el historial sirven la absoluta', async () => {
    const { uploader } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    await request(app)
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', chatId)
      .field('clientKey', 'ck-url')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    const stored = await MessageModel.findOne({ clientKey: 'ck-url' }).lean();
    expect(stored?.media?.thumbUrl?.startsWith('/files/')).toBe(true);

    const served = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(served.body.messages[0].media.thumbUrl).toMatch(/^https?:\/\//);
  });
});
