import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { listChats } from '../src/chatService.js';
import type { MediaUploader, UploadOutcome } from '../src/mediaClient.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/**
 * El perfil propio (FL9): nombre y foto. Lo ven los que no te tienen agendado
 * y la foto sale en sus listas y cabeceras, como WhatsApp. lila va FALSO.
 */
function fakeUploader(outcome?: UploadOutcome) {
  const carpetas: string[] = [];
  const uploader: MediaUploader = {
    upload: async (params) => {
      carpetas.push(params.chatId);
      return (
        outcome ?? {
          ok: true,
          media: { url: '/files/companies/constroad/apps/lilachat/perfil/image-1.jpg', sizeBytes: params.bytes.length, storageName: 'image-1.jpg' },
        }
      );
    },
  };
  return { uploader, carpetas };
}

let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let token: string;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

beforeAll(async () => {
  process.env.LILA_PUBLIC_URL = 'https://lila.constroad.com';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_perfil_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), UserModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '900000001', email: 'jose@x.com' }, { phone: '900000002', email: 'maria@x.com', name: 'María' }]);
  [jose, maria] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  token = signSession({ userId: String(jose), deviceId: 'd1', email: 'jose@x.com' });
});

describe('PUT /api/me/perfil — el nombre', () => {
  it('guarda el nombre limpio y lo devuelve', async () => {
    const res = await request(buildApp()).put('/api/me/perfil').set('Authorization', `Bearer ${token}`).send({ name: '  José   Z ' });

    expect(res.status).toBe(200);
    expect(res.body.perfil.name).toBe('José Z');
    expect((await UserModel.findById(jose).lean())?.name).toBe('José Z');
  });

  it('vacío: 400 con el motivo, y el nombre de antes queda', async () => {
    await UserModel.updateOne({ _id: jose }, { $set: { name: 'José' } });

    const res = await request(buildApp()).put('/api/me/perfil').set('Authorization', `Bearer ${token}`).send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
    expect((await UserModel.findById(jose).lean())?.name).toBe('José');
  });

  it('sin sesión: 401', async () => {
    const res = await request(buildApp()).put('/api/me/perfil').send({ name: 'x' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/me/perfil/foto — la foto', () => {
  it('sube a una carpeta propia del perfil y la devuelve absoluta', async () => {
    const { uploader, carpetas } = fakeUploader();

    const res = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/me/perfil/foto')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, { filename: 'yo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.perfil.avatarUrl).toBe('https://lila.constroad.com/files/companies/constroad/apps/lilachat/perfil/image-1.jpg');
    expect(carpetas).toEqual([`perfil-${String(jose)}`]);
  });

  it('un video no es una foto de perfil: 400 y no sube nada', async () => {
    const { uploader, carpetas } = fakeUploader();

    const res = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/me/perfil/foto')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('x'), { filename: 'v.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(400);
    expect(carpetas).toEqual([]);
  });

  it('lila sin respuesta: 503 reintentable y la foto de antes queda', async () => {
    await UserModel.updateOne({ _id: jose }, { $set: { avatarUrl: '/files/vieja.jpg' } });
    const { uploader } = fakeUploader({ ok: false, codigo: 'sin_respuesta' });

    const res = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/me/perfil/foto')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, { filename: 'yo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(503);
    expect((await UserModel.findById(jose).lean())?.avatarUrl).toBe('/files/vieja.jpg');
  });

  it('DELETE la quita', async () => {
    await UserModel.updateOne({ _id: jose }, { $set: { avatarUrl: '/files/vieja.jpg' } });

    const res = await request(buildApp()).delete('/api/me/perfil/foto').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect((await UserModel.findById(jose).lean())?.avatarUrl).toBeUndefined();
  });
});

describe('la foto de perfil en la lista del otro', () => {
  it('en un 1:1 sin foto propia del chat, se ve la foto del otro', async () => {
    await UserModel.updateOne({ _id: jose }, { $set: { avatarUrl: '/files/jose.jpg' } });
    const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: maria }], lastSeq: 0 });

    const deMaria = (await listChats(maria)).find((uno) => uno.id === String(chat._id));

    expect(deMaria?.avatarUrl).toBe('https://lila.constroad.com/files/jose.jpg');
  });
});
