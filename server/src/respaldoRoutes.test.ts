import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { huellaDeBytes } from '@lilachat/shared';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { RespaldoModel } from './respaldoModels.js';
import { MARCA_DEL_DISCO, nombreDeRespaldoValido, rutaDeRespaldo } from './respaldoDisco.js';
import { signSession } from './sessions.js';

/**
 * Los respaldos de conversaciones que suben los teléfonos (F12.1), contra un
 * disco temporal REAL y Mongo en memoria — como los 44 tests del server de
 * Lilafotos, de donde viene el patrón.
 *
 * Lo que fija: la carpeta es la del TELÉFONO de la sesión (nunca la que diga
 * el cliente), el server hashea lo que llega y decide sobre eso, el disco
 * ausente se dice con 507 en vez de escribir en el disco de arranque, y solo
 * quedan los dos últimos respaldos de cada persona.
 */
let mongo: MongoMemoryServer;
let raiz: string;
let jwt: string;
let userId: Types.ObjectId;
const TELEFONO = '51902049935';

const app = buildApp();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'lilachat-respaldos-'));
  process.env.RESPALDOS_RAIZ = raiz;
  await writeFile(path.join(raiz, MARCA_DEL_DISCO), '');
  await Promise.all([UserModel.deleteMany({}), RespaldoModel.deleteMany({})]);
  const user = await UserModel.create({ phone: TELEFONO, name: 'José' });
  userId = user._id;
  jwt = signSession({ userId: String(userId), deviceId: 'dev-1', email: TELEFONO });
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const bytesDe = (texto: string) => Buffer.from(texto, 'utf8');

const subir = (nombre: string, cuerpo: Buffer, huella = huellaDeBytes(cuerpo)) =>
  request(app)
    .put('/api/respaldos')
    .set('Authorization', `Bearer ${jwt}`)
    .set('Content-Type', 'application/octet-stream')
    .set('x-huella', huella)
    .set('x-nombre', nombre)
    .send(cuerpo);

describe('PUT /api/respaldos', () => {
  it('sin sesión, 401', async () => {
    await request(app).put('/api/respaldos').send(bytesDe('x')).expect(401);
  });

  it('guarda el respaldo en la carpeta del TELÉFONO de la sesión y lo indexa', async () => {
    const cuerpo = bytesDe('{"v":1,"sobre":"…"}');

    const respuesta = await subir('2026-09-15T22-00-00.lcb', cuerpo).expect(201);

    expect(respuesta.body).toMatchObject({ resultado: 'guardado', huella: huellaDeBytes(cuerpo), bytes: cuerpo.length });
    const enDisco = await readFile(path.join(raiz, TELEFONO, 'respaldos', '2026-09-15T22-00-00.lcb'));
    expect(enDisco.equals(cuerpo)).toBe(true);
    const indexado = await RespaldoModel.findOne({ userId }).lean();
    expect(indexado).toMatchObject({ nombre: '2026-09-15T22-00-00.lcb', huella: huellaDeBytes(cuerpo), bytes: cuerpo.length });
    await expect(readFile(path.join(raiz, '.tmp')).catch(() => 'sin-temporales')).resolves.toBe('sin-temporales');
  });

  /** El server decide sobre lo que LLEGÓ, no sobre lo que se declaró. */
  it('si la huella declarada no coincide con los bytes, 422 y no queda nada en el disco', async () => {
    const cuerpo = bytesDe('contenido real');

    await subir('r.lcb', cuerpo, 'a'.repeat(64)).expect(422);

    await expect(RespaldoModel.countDocuments({ userId })).resolves.toBe(0);
    await expect(readFile(path.join(raiz, TELEFONO, 'respaldos', 'r.lcb'))).rejects.toThrow();
  });

  it('el mismo respaldo dos veces es 200 ya_existe, sin duplicar', async () => {
    const cuerpo = bytesDe('mismo');

    await subir('r1.lcb', cuerpo).expect(201);
    const segunda = await subir('r1-otra-vez.lcb', cuerpo).expect(200);

    expect(segunda.body).toMatchObject({ resultado: 'ya_existe' });
    await expect(RespaldoModel.countDocuments({ userId })).resolves.toBe(1);
  });

  it('un nombre con barras o raro se rechaza con 400', async () => {
    await subir('../../otro/r.lcb', bytesDe('x')).expect(400);
    await subir('con espacios.lcb', bytesDe('x')).expect(400);
  });

  /** Sin tope, cualquier sesión podía llenar el disco que comparten Lilafotos y lila. */
  it('un respaldo que pasa el tope se corta con 413 y no queda nada en el disco', async () => {
    const original = process.env.RESPALDO_MAX_BYTES;
    process.env.RESPALDO_MAX_BYTES = '4';
    try {
      const respuesta = await subir('r-grande.lcb', bytesDe('demasiado')).expect(413);
      expect(respuesta.body.motivo).toBe('demasiado_grande');
      expect(await RespaldoModel.countDocuments()).toBe(0);
    } finally {
      if (original === undefined) delete process.env.RESPALDO_MAX_BYTES;
      else process.env.RESPALDO_MAX_BYTES = original;
    }
  });

  /** Sin marca no hay disco: se dice, y no se escribe en el disco de arranque. */
  it('con el disco ausente contesta 507 disco_ausente', async () => {
    await rm(path.join(raiz, MARCA_DEL_DISCO));

    const respuesta = await subir('r.lcb', bytesDe('x')).expect(507);

    expect(respuesta.body).toMatchObject({ motivo: 'disco_ausente' });
  });

  /** Solo los dos últimos: el anterior sirve por si el último salió corrupto; restic guarda el historial. */
  it('al guardar el tercero, el más viejo se va del disco y del índice', async () => {
    await subir('r1.lcb', bytesDe('uno')).expect(201);
    await subir('r2.lcb', bytesDe('dos')).expect(201);
    await subir('r3.lcb', bytesDe('tres')).expect(201);

    const nombres = (await RespaldoModel.find({ userId }).sort({ creadoEn: 1 }).lean()).map((r) => r.nombre);
    expect(nombres).toEqual(['r2.lcb', 'r3.lcb']);
    await expect(readFile(path.join(raiz, TELEFONO, 'respaldos', 'r1.lcb'))).rejects.toThrow();
    await expect(readFile(path.join(raiz, TELEFONO, 'respaldos', 'r3.lcb'), 'utf8')).resolves.toBe('tres');
  });
});

describe('POST /api/respaldos/huellas', () => {
  it('dice cuáles faltan, deduplica y separa las inválidas', async () => {
    const cuerpo = bytesDe('ya subido');
    await subir('r.lcb', cuerpo).expect(201);
    const conocida = huellaDeBytes(cuerpo);
    const nueva = 'b'.repeat(64);

    const respuesta = await request(app)
      .post('/api/respaldos/huellas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ huellas: [conocida, nueva, nueva, 'no-es-huella'] })
      .expect(200);

    expect(respuesta.body).toEqual({ faltan: [nueva], invalidas: ['no-es-huella'] });
  });

  /** Lo que subió OTRA persona no cuenta como conocido: cada carpeta es de su teléfono. */
  it('la huella de otro usuario sigue faltando para mí', async () => {
    const cuerpo = bytesDe('de otra persona');
    const otro = await UserModel.create({ phone: '51999999999', name: 'Otra' });
    await RespaldoModel.create({ userId: otro._id, nombre: 'x.lcb', huella: huellaDeBytes(cuerpo), bytes: 3, creadoEn: new Date() });

    const respuesta = await request(app)
      .post('/api/respaldos/huellas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ huellas: [huellaDeBytes(cuerpo)] })
      .expect(200);

    expect(respuesta.body.faltan).toEqual([huellaDeBytes(cuerpo)]);
  });
});

describe('GET /api/respaldos/ultimo y /:nombre', () => {
  it('sin respaldos, ultimo es null', async () => {
    const respuesta = await request(app).get('/api/respaldos/ultimo').set('Authorization', `Bearer ${jwt}`).expect(200);

    expect(respuesta.body).toEqual({ respaldo: null });
  });

  it('el último es el más reciente, y se baja entero', async () => {
    await subir('r1.lcb', bytesDe('uno')).expect(201);
    await subir('r2.lcb', bytesDe('dos')).expect(201);

    const ultimo = await request(app).get('/api/respaldos/ultimo').set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(ultimo.body.respaldo).toMatchObject({ nombre: 'r2.lcb', bytes: 3, huella: huellaDeBytes(bytesDe('dos')) });

    const bajado = await request(app).get('/api/respaldos/r2.lcb').set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(bajado.headers['content-length']).toBe('3');
    expect(Buffer.from(bajado.body).toString('utf8')).toBe('dos');
  });

  /** El respaldo de otra persona no se baja aunque se sepa el nombre: 404, igual que «no existe». */
  it('el respaldo de otro usuario es 404 para mí', async () => {
    const otro = await UserModel.create({ phone: '51999999999', name: 'Otra' });
    await RespaldoModel.create({ userId: otro._id, nombre: 'ajeno.lcb', huella: 'c'.repeat(64), bytes: 1, creadoEn: new Date() });

    await request(app).get('/api/respaldos/ajeno.lcb').set('Authorization', `Bearer ${jwt}`).expect(404);
  });
});

/**
 * FL5 (§44.4): el GET era `createReadStream(...).pipe(res)`. Con el archivo
 * indexado pero ausente del disco, el 'error' del stream no lo escuchaba nadie:
 * en Node eso tumba el proceso, y el cliente quedaba colgado hasta su timeout.
 */
describe('GET /api/respaldos/:nombre cuando el disco no acompaña', () => {
  it('indexado pero sin archivo en el disco: 404 en palabras, el server sigue vivo', async () => {
    await subir('r1.lcb', bytesDe('uno')).expect(201);
    await rm(path.join(raiz, rutaDeRespaldo(TELEFONO, 'r1.lcb')));

    const respuesta = await request(app).get('/api/respaldos/r1.lcb').set('Authorization', `Bearer ${jwt}`).timeout(4_000);

    expect(respuesta.status).toBe(404);
    await request(app).get('/api/respaldos/ultimo').set('Authorization', `Bearer ${jwt}`).expect(200);
  });
});

/** Dos filas con el mismo nombre para la misma persona harían ambiguo el GET y la retención. */
describe('índice de Respaldo', () => {
  it('el nombre es único por persona', async () => {
    await RespaldoModel.init();
    const fila = { userId, nombre: 'r1.lcb', bytes: 1, creadoEn: new Date() };
    await RespaldoModel.create({ ...fila, huella: 'a'.repeat(64) });

    await expect(RespaldoModel.create({ ...fila, huella: 'b'.repeat(64) })).rejects.toThrow(/duplicate key/);
  });
});

describe('GET /api/respaldos/estado', () => {
  it('cuenta el disco, la copia y cuántos respaldos tengo', async () => {
    await subir('r1.lcb', bytesDe('uno')).expect(201);
    await writeFile(path.join(raiz, '.copia-a-la-mini.json'), JSON.stringify({ ultimaEn: '2026-09-15T01:30:00Z', ok: true }));

    const respuesta = await request(app).get('/api/respaldos/estado').set('Authorization', `Bearer ${jwt}`).expect(200);

    expect(respuesta.body).toMatchObject({
      disco: { estado: 'montado' },
      copia: { ultimaEn: '2026-09-15T01:30:00Z', ok: true },
      cantidad: 1,
    });
    expect(respuesta.body.ultimo).toMatchObject({ nombre: 'r1.lcb' });
  });

  it('sin disco, lo dice sin colgarse', async () => {
    await rm(path.join(raiz, MARCA_DEL_DISCO));

    const respuesta = await request(app).get('/api/respaldos/estado').set('Authorization', `Bearer ${jwt}`).expect(200);

    expect(respuesta.body.disco.estado).toBe('ausente');
    expect(respuesta.body.copia).toBeNull();
  });
});

describe('motores puros', () => {
  it('rutaDeRespaldo: la carpeta es el teléfono, después «respaldos», después el nombre', () => {
    expect(rutaDeRespaldo(TELEFONO, 'r.lcb')).toBe('51902049935/respaldos/r.lcb');
  });

  it('nombreDeRespaldoValido: letras, números, guiones, puntos; sin barras ni espacios', () => {
    expect(nombreDeRespaldoValido('2026-09-15T22-00-00.lcb')).toBe(true);
    expect(nombreDeRespaldoValido('../x')).toBe(false);
    expect(nombreDeRespaldoValido('a b')).toBe(false);
    expect(nombreDeRespaldoValido('')).toBe(false);
    expect(nombreDeRespaldoValido('.lcb')).toBe(false);
  });
});
