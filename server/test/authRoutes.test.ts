import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthClient, AuthOutcome } from '../src/authClient.js';
import { buildApp } from '../src/app.js';
import { DeviceModel, InvitationModel, UserModel } from '../src/models.js';

/**
 * El alta contra constroad-auth, con el servicio FALSO e inyectado: lo que se
 * prueba acá es NUESTRO gate y NUESTRO espejo, no el servicio de ellos (que ya
 * tiene sus tests). El E2E real contra el servicio vivo va aparte, con la
 * llave de José.
 */

type Call = { method: string; args: unknown[] };

function fakeAuthClient(overrides: Partial<AuthClient> = {}) {
  const calls: Call[] = [];
  const ok = <T>(valor: T): Promise<AuthOutcome<T>> => Promise.resolve({ ok: true, valor });
  const base: AuthClient = {
    requestCode: () => ok({ canal: 'email' }),
    verifyCode: () => ok({ secreto: 'device-secret-123' }),
    validateDevice: () =>
      ok({ companyId: 'constroad', identidad: 'papa@gmail.com', app: 'lilachat' }),
  };

  // El registro envuelve TAMBIÉN a lo sobrescrito. Antes los overrides se
  // aplicaban con un spread encima y reemplazaban la implementación que
  // anotaba: un test que sobrescribía `requestCode` veía `calls` vacío y
  // afirmaba lo contrario de la verdad.
  const client = Object.fromEntries(
    (Object.keys(base) as (keyof AuthClient)[]).map((method) => [
      method,
      (...args: unknown[]) => {
        calls.push({ method, args });
        const impl = (overrides[method] ?? base[method]) as (...a: unknown[]) => unknown;
        return impl(...args);
      },
    ])
  ) as unknown as AuthClient;

  return { client, calls };
}

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    InvitationModel.deleteMany({}),
    UserModel.deleteMany({}),
    DeviceModel.deleteMany({}),
  ]);
  await InvitationModel.create({ phone: '902049935', email: 'papa@gmail.com', invitedBy: 'seed' });
});

describe('POST /api/auth/otp/request', () => {
  it('invitado: pide el código al servicio y responde el genérico', async () => {
    const { client, calls } = fakeAuthClient();
    const response = await request(buildApp({ authClient: client }))
      .post('/api/auth/otp/request')
      .send({ phone: ' 902 049 935 ' });

    expect(response.status).toBe(200);
    expect(calls.filter((c) => c.method === 'requestCode')).toHaveLength(1);
    expect(calls[0]?.args[0]).toBe('51902049935');
  });

  /**
   * **Registro ABIERTO desde el 26/08/2026.**
   *
   * Este test decía «CERO llamadas al servicio» para quien no estaba invitado: el
   * server fingía el envío para no confirmarle a un extraño quién está en la
   * lista. Lilachat pasó a ser pública por decisión de José, así que ahora a
   * cualquier número se le manda de verdad.
   *
   * Lo que NO cambió y se sigue fijando: los dos reciben **el mismo cuerpo**. Es
   * lo que queda del gate anti-enumeración, y sigue importando — la respuesta no
   * puede empezar a distinguir a quien ya tiene cuenta de quien no.
   */
  it('a cualquier número se le manda, y la respuesta es la misma para todos', async () => {
    const { client, calls } = fakeAuthClient();
    const app = buildApp({ authClient: client });

    const invited = await request(app).post('/api/auth/otp/request').send({ phone: '902049935' });
    const stranger = await request(app).post('/api/auth/otp/request').send({ phone: '987654321' });

    expect(stranger.status).toBe(invited.status);
    expect(stranger.body).toEqual(invited.body);
    // Dos números, dos envíos: el desconocido ya no se queda esperando algo que
    // nunca salió, que es exactamente lo que le pasó a Wilson.
    expect(calls.filter((c) => c.method === 'requestCode')).toHaveLength(2);
  });

  it('email sin forma de email: 400 sin tocar el servicio', async () => {
    const { client, calls } = fakeAuthClient();
    const response = await request(buildApp({ authClient: client }))
      .post('/api/auth/otp/request')
      .send({ phone: { $ne: '' } });

    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('POST /api/auth/otp/verify', () => {
  const verifyBody = { phone: '902049935', code: '123456', deviceId: 'dev-1', name: 'Papá' };

  it('código correcto: crea usuario + espejo del device y devuelve secreto + jwt', async () => {
    const { client } = fakeAuthClient();
    const response = await request(buildApp({ authClient: client }))
      .post('/api/auth/otp/verify')
      .send(verifyBody);

    expect(response.status).toBe(200);
    expect(response.body.deviceSecret).toBe('device-secret-123');
    expect(typeof response.body.jwt).toBe('string');

    const user = await UserModel.findOne({ phone: '902049935' }).lean();
    expect(user?.name).toBe('Papá');
    const device = await DeviceModel.findOne({ deviceId: 'dev-1' }).lean();
    expect(String(device?.userId)).toBe(String(user?._id));
  });

  /**
   * **Registro ABIERTO.** Antes, no estar invitado se rechazaba con el mismo
   * error que un código malo. Ahora lo único que decide es si el código que
   * llegó a ESE número es correcto —eso lo prueba constroad-auth—, así que
   * alguien sin admisión completa el alta y queda como usuario.
   */
  it('sin invitación previa, el alta se completa igual', async () => {
    const { client, calls } = fakeAuthClient();
    const response = await request(buildApp({ authClient: client }))
      .post('/api/auth/otp/verify')
      .send({ ...verifyBody, phone: '987654321' });

    expect(response.status).toBe(200);
    expect(calls.filter((c) => c.method === 'verifyCode').length).toBeGreaterThan(0);
    expect(await UserModel.countDocuments({ phone: '987654321' })).toBe(1);
  });

  it('código rechazado por el servicio: 401 con el MISMO mensaje que no-invitado', async () => {
    const rejected = fakeAuthClient({
      verifyCode: () => Promise.resolve({ ok: false, codigo: 'codigo_invalido' }),
    });
    const app = buildApp({ authClient: rejected.client });

    const badCode = await request(app).post('/api/auth/otp/verify').send(verifyBody);
    const stranger = await request(app)
      .post('/api/auth/otp/verify')
      .send({ ...verifyBody, phone: '987654321' });

    expect(badCode.status).toBe(401);
    expect(badCode.body).toEqual(stranger.body);
  });
});

describe('POST /api/auth/session', () => {
  it('credencial válida: jwt nuevo', async () => {
    const { client } = fakeAuthClient();
    const app = buildApp({ authClient: client });
    await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '902049935', code: '123456', deviceId: 'dev-1' });

    const response = await request(app)
      .post('/api/auth/session')
      .send({ deviceId: 'dev-1', deviceSecret: 'device-secret-123' });

    expect(response.status).toBe(200);
    expect(typeof response.body.jwt).toBe('string');
  });

  it('el servicio dijo NO (revocado): 401', async () => {
    const revoked = fakeAuthClient({
      validateDevice: () => Promise.resolve({ ok: false, codigo: 'credencial_invalida' }),
    });
    const response = await request(buildApp({ authClient: revoked.client }))
      .post('/api/auth/session')
      .send({ deviceId: 'dev-1', deviceSecret: 'x' });

    expect(response.status).toBe(401);
  });

  /**
   * LA REGLA ESCRITA de constroad-auth: la ausencia de respuesta NO revoca.
   * Un fallo de red tiene que dar 503 (reintentable), jamás el mismo 401 que
   * una revocación — o toda la familia queda desenrolada cuando la red está mal.
   */
  it('el servicio no contestó: 503, NUNCA 401', async () => {
    const down = fakeAuthClient({
      validateDevice: () => Promise.resolve({ ok: false, codigo: 'sin_respuesta' }),
    });
    const response = await request(buildApp({ authClient: down.client }))
      .post('/api/auth/session')
      .send({ deviceId: 'dev-1', deviceSecret: 'x' });

    expect(response.status).toBe(503);
  });
});

describe('POST /api/auth/session — reparación de credenciales viejas', () => {
  /**
   * Una credencial guardada antes de que existiera `userId` deja a la app sin
   * saber cuáles mensajes son propios: TODOS se ven como ajenos. El refresh
   * devuelve el usuario para que la app se repare sola.
   */
  it('devuelve el usuario, no solo el jwt', async () => {
    const { client } = fakeAuthClient();
    const app = buildApp({ authClient: client });
    await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '902049935', code: '123456', deviceId: 'dev-1' });

    const response = await request(app)
      .post('/api/auth/session')
      .send({ deviceId: 'dev-1', deviceSecret: 'device-secret-123' });

    expect(response.body.user).toMatchObject({ phone: '902049935' });
    expect(response.body.user.id).toMatch(/^[a-f0-9]{24}$/);
  });
});

describe('respaldo por correo', () => {
  /**
   * El respaldo tiene que poder PEDIRSE. Solo reaccionar a un fallo de WhatsApp
   * no cubre el caso real: WhatsApp responde «ok» y el mensaje igual no llega
   * (o el usuario no lo ve), y ahí no hay error que dispare nada.
   */
  it('pedirlo manda el código SOLO al correo', async () => {
    const { client, calls } = fakeAuthClient();
    await request(buildApp({ authClient: client }))
      .post('/api/auth/otp/request')
      .send({ phone: '902049935', preferEmail: true });

    const sends = calls.filter((call) => call.method === 'requestCode');
    expect(sends).toHaveLength(1);
    expect(sends[0]?.args[0]).toBe('papa@gmail.com');
  });

  /**
   * LA REGLA: el respaldo se PIDE. Mandarlo solo cuando WhatsApp falla vuelve
   * inútil el botón —el correo llega sin haberlo pedido— y gasta dos envíos y
   * dos códigos válidos donde alcanza uno.
   */
  it('sin pedirlo va SOLO por WhatsApp, aunque WhatsApp falle', async () => {
    const failing = fakeAuthClient({
      requestCode: () => Promise.resolve({ ok: false, codigo: 'error' }),
    });
    await request(buildApp({ authClient: failing.client }))
      .post('/api/auth/otp/request')
      .send({ phone: '902049935' });

    const sends = failing.calls.filter((call) => call.method === 'requestCode');
    expect(sends).toHaveLength(1);
    expect(sends[0]?.args[0]).toBe('51902049935');
  });

  /**
   * La respuesta NO puede decir si hay respaldo. Se intentó devolver un
   * `emailFallback` para que la app supiera si mostrar el botón, y el test
   * anti-enumeración de arriba lo tumbó: invitado y extraño quedaban con
   * cuerpos distintos. La app lo ofrece siempre; el server decide en silencio.
   */
  it('pedir el respaldo tampoco delata al invitado', async () => {
    const { client } = fakeAuthClient();
    const app = buildApp({ authClient: client });

    const invited = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '902049935', preferEmail: true });
    const stranger = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '987654321', preferEmail: true });

    expect(stranger.body).toEqual(invited.body);
    expect(JSON.stringify(invited.body)).not.toContain('papa@gmail.com');
  });
});
