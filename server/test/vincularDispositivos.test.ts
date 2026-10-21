import { createServer, type Server as HttpServer } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthClient } from '../src/authClient.js';
import { buildApp } from '../src/app.js';
import { DeviceModel, UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';
import { crearVinculaciones } from '../src/vinculaciones.js';

/**
 * Vincular la web con el QR del teléfono (W5, spec §54.4), contra la base y
 * el socket reales. constroad-auth es falso y NUNCA debe tocarse: el
 * dispositivo vinculado es nuestro, no de ese servicio.
 */
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TELEFONO = '8d1c2c2e-0b7c-4c1a-9f57-0d3f5a1e2b3c';
const ESPERA_MS = 80;

let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let port: number;
let jose: Types.ObjectId;
let jwtDelTelefono: string;
let llamadasAlServicio: string[];
const clientes: ClientSocket[] = [];

const authFalso: AuthClient = {
  requestCode: async () => ({ ok: true, valor: { canal: 'whatsapp' } }),
  verifyCode: async () => ({ ok: true, valor: { secreto: 's' } }),
  validateDevice: async (deviceId) => {
    llamadasAlServicio.push(deviceId);
    return { ok: false, codigo: 'rechazado' };
  },
};

const conectar = (token: string): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = createClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
    clientes.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const api = () => request(httpServer);
const cookieDe = (respuesta: request.Response): string => String([respuesta.headers['set-cookie']].flat()[0] ?? '');

/** La web pide un QR, el teléfono lo aprueba y la web lo canjea. */
async function vincular(opciones: { mantener?: boolean } = {}) {
  const inicio = await api().post('/api/auth/vincular/iniciar').set('User-Agent', CHROME_MAC).send({});
  const aprobado = await api().post('/api/vinculos/aprobar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: inicio.body.token });
  const canje = await api().post('/api/auth/vincular/esperar').send({ id: inicio.body.id, clave: inicio.body.clave, mantener: opciones.mantener ?? true });
  return { inicio, aprobado, canje, cookie: cookieDe(canje) };
}

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_vincular_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  llamadasAlServicio = [];
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({})]);
  const usuario = await UserModel.create({ phone: '902049935', name: 'José' });
  jose = usuario._id;
  await DeviceModel.create({ deviceId: TELEFONO, userId: jose, platform: 'android' });
  jwtDelTelefono = signSession({ userId: String(jose), deviceId: TELEFONO, email: '902049935' });
  httpServer = createServer(buildApp({ authClient: authFalso, vinculacion: { vinculaciones: crearVinculaciones(), esperaMs: ESPERA_MS, limitePorMinuto: 5 } }));
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterEach(async () => {
  for (const cliente of clientes.splice(0)) cliente.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe('vincular por QR', () => {
  it('flujo completo: QR → el teléfono aprueba → la web entra con cookie y JWT', async () => {
    const { inicio, aprobado, canje, cookie } = await vincular();

    expect(inicio.status).toBe(200);
    expect(inicio.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(aprobado.status).toBe(200);
    expect(aprobado.body.nombre).toBe('Chrome en macOS');
    expect(canje.status).toBe(200);
    expect(canje.body.estado).toBe('vinculada');
    expect(canje.body.user).toMatchObject({ id: String(jose), name: 'José', phone: '902049935' });
    expect(canje.body.deviceSecret).toBeUndefined();
    expect(cookie).toMatch(/^lilachat_dispositivo=vinculado-/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Max-Age=');

    const vinculado = await DeviceModel.findOne({ deviceId: /^vinculado-/ }).lean();
    expect(vinculado).toMatchObject({ userId: jose, platform: 'web', nombre: 'Chrome en macOS', vinculadoPor: TELEFONO });
    // Solo el hash: el secreto vive en la cookie y en ningún otro lado.
    const secreto = decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!).split(':')[1]!;
    expect(vinculado?.secretoHash).toBeTruthy();
    expect(vinculado?.secretoHash).not.toContain(secreto);

    // Con su JWT ya usa la API como el dueño.
    const chats = await api().get('/api/chats').set('Authorization', `Bearer ${canje.body.jwt}`);
    expect(chats.status).toBe(200);
  });

  it('la cookie renueva la sesión SIN preguntarle a constroad-auth', async () => {
    const { cookie } = await vincular();
    const renovada = await api().post('/api/auth/session').set('Cookie', cookie.split(';')[0]!).send({ cliente: 'web' });
    expect(renovada.status).toBe(200);
    expect(renovada.body.user.id).toBe(String(jose));
    expect(llamadasAlServicio).toEqual([]);
  });

  it('«Mantener la sesión iniciada» apagado: cookie de sesión, también al renovar', async () => {
    const { cookie } = await vincular({ mantener: false });
    expect(cookie).not.toContain('Max-Age=');
    const renovada = await api().post('/api/auth/session').set('Cookie', cookie.split(';')[0]!).send({ cliente: 'web' });
    expect(cookieDe(renovada)).not.toContain('Max-Age=');
  });

  it('sin aprobación, esperar devuelve «pendiente» al vencer la espera', async () => {
    const inicio = await api().post('/api/auth/vincular/iniciar').send({});
    const espera = await api().post('/api/auth/vincular/esperar').send({ id: inicio.body.id, clave: inicio.body.clave });
    expect(espera.status).toBe(200);
    expect(espera.body).toEqual({ estado: 'pendiente' });
    expect(espera.headers['set-cookie']).toBeUndefined();
  });

  it('el QR rota y el token nuevo sirve para la misma vinculación', async () => {
    const inicio = await api().post('/api/auth/vincular/iniciar').send({});
    const rotado = await api().post('/api/auth/vincular/rotar').send({ id: inicio.body.id, clave: inicio.body.clave });
    expect(rotado.status).toBe(200);
    expect(rotado.body.token).not.toBe(inicio.body.token);
    const aprobado = await api().post('/api/vinculos/aprobar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: rotado.body.token });
    expect(aprobado.status).toBe(200);
  });

  it('clave equivocada o vinculación inexistente: 410, nunca una sesión', async () => {
    const inicio = await api().post('/api/auth/vincular/iniciar').send({});
    await api().post('/api/vinculos/aprobar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: inicio.body.token });
    const conElToken = await api().post('/api/auth/vincular/esperar').send({ id: inicio.body.id, clave: inicio.body.token });
    expect(conElToken.status).toBe(410);
    const rotar = await api().post('/api/auth/vincular/rotar').send({ id: 'x', clave: 'y' });
    expect(rotar.status).toBe(410);
  });

  it('un token inventado o ya usado: consultar y aprobar dan 410', async () => {
    const inventado = 'A'.repeat(43);
    const consulta = await api().post('/api/vinculos/consultar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: inventado });
    expect(consulta.status).toBe(410);
    const { inicio } = await vincular();
    const otraVez = await api().post('/api/vinculos/aprobar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: inicio.body.token });
    expect(otraVez.status).toBe(410);
  });

  it('consultar muestra el nombre del navegador antes de aprobar', async () => {
    const inicio = await api().post('/api/auth/vincular/iniciar').set('User-Agent', CHROME_MAC).send({});
    const consulta = await api().post('/api/vinculos/consultar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: inicio.body.token });
    expect(consulta.status).toBe(200);
    expect(consulta.body).toEqual({ nombre: 'Chrome en macOS' });
  });

  it('una web vinculada no puede vincular a otra ni ver la lista (403)', async () => {
    const { canje } = await vincular();
    const inicio = await api().post('/api/auth/vincular/iniciar').send({});
    const comoWeb = (ruta: string) => api().post(ruta).set('Authorization', `Bearer ${canje.body.jwt}`).send({ token: inicio.body.token });
    expect((await comoWeb('/api/vinculos/consultar')).status).toBe(403);
    expect((await comoWeb('/api/vinculos/aprobar')).status).toBe(403);
    expect((await api().get('/api/vinculos').set('Authorization', `Bearer ${canje.body.jwt}`)).status).toBe(403);
  });

  it('hasta 4 vinculados: el quinto da 409 con el motivo', async () => {
    for (let indice = 0; indice < 4; indice += 1) expect((await vincular()).canje.status).toBe(200);
    const inicio = await api().post('/api/auth/vincular/iniciar').send({});
    const quinto = await api().post('/api/vinculos/aprobar').set('Authorization', `Bearer ${jwtDelTelefono}`).send({ token: inicio.body.token });
    expect(quinto.status).toBe(409);
    expect(quinto.body.message).toMatch(/4/);
  });

  it('la lista muestra nombre y último uso, nunca el hash', async () => {
    await vincular();
    const lista = await api().get('/api/vinculos').set('Authorization', `Bearer ${jwtDelTelefono}`);
    expect(lista.status).toBe(200);
    expect(lista.body.dispositivos).toHaveLength(1);
    expect(lista.body.dispositivos[0]).toMatchObject({ nombre: 'Chrome en macOS' });
    expect(lista.body.dispositivos[0].deviceId).toMatch(/^vinculado-/);
    expect(lista.body.dispositivos[0].ultimoUso).toBeTruthy();
    expect(JSON.stringify(lista.body)).not.toContain('secretoHash');
  });

  it('cerrar su sesión desde el teléfono: 401 en la API, sin renovar y con el socket cortado', async () => {
    const { canje, cookie } = await vincular();
    const socket = await conectar(canje.body.jwt);
    const cortado = new Promise<void>((resolve) => socket.on('disconnect', () => resolve()));

    const lista = await api().get('/api/vinculos').set('Authorization', `Bearer ${jwtDelTelefono}`);
    const deviceId = lista.body.dispositivos[0].deviceId as string;
    const borrado = await api().delete(`/api/vinculos/${deviceId}`).set('Authorization', `Bearer ${jwtDelTelefono}`);
    expect(borrado.status).toBe(204);
    await cortado;

    expect((await api().get('/api/chats').set('Authorization', `Bearer ${canje.body.jwt}`)).status).toBe(401);
    const renovada = await api().post('/api/auth/session').set('Cookie', cookie.split(';')[0]!).send({ cliente: 'web' });
    expect(renovada.status).toBe(401);
    expect(cookieDe(renovada)).toContain('Max-Age=0');
    expect(llamadasAlServicio).toEqual([]);
    await expect(conectar(canje.body.jwt)).rejects.toThrow('unauthorized');
  });

  it('no se cierra la sesión de un dispositivo ajeno ni la del teléfono (404)', async () => {
    const otro = await UserModel.create({ phone: '999888777' });
    await DeviceModel.create({ deviceId: 'vinculado-ajeno', userId: otro._id, platform: 'web', vinculadoPor: 'x', secretoHash: 'h', nombre: 'Edge en Windows' });
    const autorizado = (ruta: string) => api().delete(ruta).set('Authorization', `Bearer ${jwtDelTelefono}`);
    expect((await autorizado('/api/vinculos/vinculado-ajeno')).status).toBe(404);
    expect((await autorizado(`/api/vinculos/${TELEFONO}`)).status).toBe(404);
    expect(await DeviceModel.countDocuments({})).toBe(2);
  });

  it('«Cerrar sesión» en la web vinculada borra ese dispositivo', async () => {
    const { cookie } = await vincular();
    const salir = await api().post('/api/auth/salir').set('Cookie', cookie.split(';')[0]!);
    expect(salir.status).toBe(204);
    expect(await DeviceModel.countDocuments({ deviceId: /^vinculado-/ })).toBe(0);
  });

  it('una cookie con el secreto equivocado no borra ni renueva', async () => {
    const { cookie } = await vincular();
    const deviceId = decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!).split(':')[0]!;
    const falsa = `lilachat_dispositivo=${encodeURIComponent(`${deviceId}:otro-secreto`)}`;
    expect((await api().post('/api/auth/salir').set('Cookie', falsa)).status).toBe(204);
    expect(await DeviceModel.countDocuments({ deviceId })).toBe(1);
    expect((await api().post('/api/auth/session').set('Cookie', falsa).send({ cliente: 'web' })).status).toBe(401);
  });

  it('pedir QR tiene límite por IP (429)', async () => {
    const estados: number[] = [];
    for (let indice = 0; indice < 6; indice += 1) estados.push((await api().post('/api/auth/vincular/iniciar').send({})).status);
    expect(estados.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(estados[5]).toBe(429);
  });
});
