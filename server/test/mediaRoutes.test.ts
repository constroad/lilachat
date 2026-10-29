import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import type { MediaUploader, UploadOutcome } from '../src/mediaClient.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { toClientMessage } from '../src/messageView.js';
import { advanceChain, createMediaKey, decryptMessage, deriveSessionRoot, encryptMessage, generateIdentity, openMediaFile, parseMediaSecret, sealMediaFile, serializeMediaSecret, MEDIA_CHUNK } from '@lilachat/shared';

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
  mongo = await startTestMongo();
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

  /**
   * Las dimensiones de la foto (FL9): la burbuja la dibuja con su forma, no
   * recortada en un cuadrado de 220. Solo enteros razonables; lo demás se
   * ignora y la burbuja cae al cuadrado de siempre.
   */
  it('guarda ancho y alto de la foto; lo absurdo se ignora', async () => {
    const { uploader } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const subir = (clientKey: string, width: string, height: string) =>
      request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .field('chatId', chatId)
        .field('clientKey', clientKey)
        .field('width', width)
        .field('height', height)
        .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    const buena = await subir('ck-dim-1', '4000', '3000');
    const mala = await subir('ck-dim-2', '-5', 'abc');

    expect(buena.body.message.media).toMatchObject({ width: 4000, height: 3000 });
    expect(mala.body.message.media.width).toBeUndefined();
    expect(mala.body.message.media.height).toBeUndefined();
  });

  /** Pending 12: photos sent together carry the same album id, so the chat draws them as one card. */
  it('keeps the album id of photos sent together; a broken one is left out', async () => {
    const { uploader } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const send = (clientKey: string, albumId: string) =>
      request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .field('chatId', chatId)
        .field('clientKey', clientKey)
        .field('albumId', albumId)
        .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    const good = await send('ck-album-1', 'almq2x1abc123');
    const broken = await send('ck-album-2', 'no vale!');

    expect(good.body.message.media.album).toBe('almq2x1abc123');
    expect(broken.body.message.media.album).toBeUndefined();
  });

  /**
   * La onda de una nota de voz (FL9): barras de 0 a 100, como WhatsApp. Lo que
   * no son números se ignora y la nota se dibuja con la línea de siempre.
   */
  it('guarda la onda de la nota de voz; lo roto se ignora', async () => {
    const { uploader } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const audio = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const subir = (clientKey: string, onda: string) =>
      request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .field('chatId', chatId)
        .field('clientKey', clientKey)
        .field('durationMs', '3000')
        .field('onda', onda)
        .attach('file', audio, { filename: 'nota.m4a', contentType: 'audio/m4a' });

    const buena = await subir('ck-onda-1', '0,25,250,-3,60.4');
    const mala = await subir('ck-onda-2', 'hola');

    expect(buena.body.message.media.onda).toEqual([0, 25, 100, 0, 60]);
    expect(mala.body.message.media.onda).toBeUndefined();
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

/**
 * Auditoría (19/10): el reintento de una foto (el teléfono no vio la
 * respuesta) volvía a subir el archivo a lila y dejaba uno huérfano. El
 * duplicado se reconoce ANTES de subir.
 */
describe('reintento de la misma foto', () => {
  it('con el mismo clientKey no se vuelve a subir a lila', async () => {
    const { uploader, calls } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const send = () =>
      request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .field('chatId', chatId)
        .field('clientKey', 'ck-media-reintento')
        .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    await send();
    const retry = await send();

    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBe(true);
    expect(retry.body.url).toMatch(/^https:\/\/lila\.constroad\.com\//);
    expect(calls).toHaveLength(1);
  });
});

describe('la respuesta de la subida', () => {
  it('trae el mensaje con las URLs absolutas, como el socket', async () => {
    const { uploader } = fakeUploader();
    const response = await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', chatId)
      .field('clientKey', 'ck-forma')
      .attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(response.body.message.clientKey).toBe('ck-forma');
    expect(response.body.message.media.url).toMatch(/^https:\/\/lila\.constroad\.com\//);
  });
});

/**
 * The photos and videos of a secret chat (pending 67 / F12.3, José 29/10): the
 * phone sends the file already encrypted and its key inside the sealed text,
 * so the server keeps bytes it cannot read and makes no thumbnail of them.
 */
describe('POST /api/media with an envelope (secret chat)', () => {
  const sealed = Buffer.alloc(300, 7);
  const envelope = { v: 1, nonce: 'bm9uY2U=', ciphertext: 'c2VjcmV0bw==' };

  async function secretChat() {
    const chat = await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: jose, role: 'admin' }, { userId: ajeno, role: 'member' }], lastSeq: 0 });
    return String(chat._id);
  }
  const sendSealed = (app: ReturnType<typeof buildApp>, chat: string, fields: Record<string, string>) => {
    let call = request(app).post('/api/media').set('Authorization', `Bearer ${token}`).field('chatId', chat).field('clientKey', fields.clientKey ?? 'ck-sealed');
    for (const [name, value] of Object.entries(fields)) if (name !== 'clientKey') call = call.field(name, value);
    return call.attach('file', sealed, { filename: 'sellado', contentType: 'application/octet-stream' });
  };

  it('keeps the sealed text and the file with no name, shape, caption or thumbnail', async () => {
    // Arrange
    const { uploader, calls } = fakeUploader();
    const chat = await secretChat();
    // Act
    const response = await sendSealed(buildApp({ mediaUploader: uploader }), chat, { envelope: JSON.stringify(envelope), sealedKind: 'image', caption: 'en claro', width: '4000', height: '3000' });
    // Assert
    expect(response.status).toBe(201);
    expect(calls[0]).toMatchObject({ kind: 'file', bytes: 300 });
    const saved = await MessageModel.findOne({ chatId: chat }).lean();
    expect(saved).toMatchObject({ kind: 'image', envelope });
    expect(saved?.body).toBeUndefined();
    expect(saved?.media).toMatchObject({ mime: 'application/octet-stream', fileName: 'sellado', sizeBytes: 300 });
    expect(saved?.media?.thumbUrl).toBeUndefined();
    expect(saved?.media?.width).toBeUndefined();
  });

  it('a plain photo in a secret chat is refused before it is stored', async () => {
    const { uploader, calls } = fakeUploader();
    const chat = await secretChat();
    const response = await request(buildApp({ mediaUploader: uploader })).post('/api/media').set('Authorization', `Bearer ${token}`).field('chatId', chat).field('clientKey', 'ck-plain').attach('file', jpeg, { filename: 'foto.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect(await MessageModel.countDocuments({ chatId: chat })).toBe(0);
  });

  it('refuses a broken envelope, an unknown kind, and a sealed file in an ordinary chat', async () => {
    // Arrange
    const { uploader, calls } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const chat = await secretChat();
    // Act
    const broken = await sendSealed(app, chat, { clientKey: 'a', envelope: '{"v":1}', sealedKind: 'image' });
    const kind = await sendSealed(app, chat, { clientKey: 'b', envelope: JSON.stringify(envelope), sealedKind: 'sticker' });
    const ordinary = await sendSealed(app, chatId, { clientKey: 'c', envelope: JSON.stringify(envelope), sealedKind: 'image' });
    // Assert
    expect(broken.status).toBe(400);
    expect(kind.status).toBe(400);
    expect(ordinary.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  // Documents and voice notes too (José 29/10: «termina tus pendientes»).
  it('a sealed document and a sealed voice note are kept like a sealed photo: no name, no type', async () => {
    // Arrange
    const { uploader, calls } = fakeUploader();
    const app = buildApp({ mediaUploader: uploader });
    const chat = await secretChat();
    // Act
    const document = await sendSealed(app, chat, { clientKey: 'doc', envelope: JSON.stringify(envelope), sealedKind: 'file' });
    const voice = await sendSealed(app, chat, { clientKey: 'voz', envelope: JSON.stringify(envelope), sealedKind: 'audio' });
    // Assert
    expect([document.status, voice.status]).toEqual([201, 201]);
    expect(calls.map((call) => [call.fileName, call.kind])).toEqual([['sellado', 'file'], ['sellado', 'file']]);
  });
});

describe('a secret photo from one phone to the other', () => {
  it('the other phone opens the sealed text, finds the key and gets back the same bytes', async () => {
    // Arrange: two phones with their own identities, as `deviceKeys.claveDeMensajes` derives them.
    const mine = generateIdentity();
    const theirs = generateIdentity();
    const keyOf = (own: typeof mine, other: typeof mine) => advanceChain(deriveSessionRoot({ myPrivateKey: own.privateKey, theirPublicKey: other.publicKey })).messageKey;
    const photo = Uint8Array.from({ length: MEDIA_CHUNK + 999 }, (_, index) => (index * 7) % 256);
    const fileKey = createMediaKey();
    const envelope = encryptMessage(keyOf(mine, theirs), serializeMediaSecret({ key: fileKey, mime: 'image/jpeg', fileName: 'obra.jpg', sizeBytes: photo.length, width: 1080, height: 1440, caption: 'Avance' }));
    let stored = new Uint8Array(0);
    const uploader: MediaUploader = {
      upload: async (params) => {
        stored = new Uint8Array(params.bytes);
        return { ok: true, media: { url: '/media/chats/x/abc.bin', thumbnailStatus: 'unsupported', sizeBytes: params.bytes.length, storageName: 'abc.bin' } };
      },
    };
    const chat = await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: jose, role: 'admin' }, { userId: ajeno, role: 'member' }], lastSeq: 0 });
    // Act
    await request(buildApp({ mediaUploader: uploader }))
      .post('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .field('chatId', String(chat._id))
      .field('clientKey', 'ck-roundtrip')
      .field('envelope', JSON.stringify(envelope))
      .field('sealedKind', 'image')
      .attach('file', Buffer.from(sealMediaFile(photo, fileKey)), { filename: 'sellado', contentType: 'application/octet-stream' });
    const received = toClientMessage((await MessageModel.findOne({ chatId: chat._id }).lean())!);
    const secret = parseMediaSecret(decryptMessage(keyOf(theirs, mine), received.envelope as typeof envelope));
    // Assert
    expect(received.media?.url).toBeTruthy();
    expect(secret).toMatchObject({ mime: 'image/jpeg', caption: 'Avance', width: 1080 });
    expect(openMediaFile(stored, secret!.key)).toEqual(photo);
  });
});
