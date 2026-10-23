import { open, type FileHandle } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { decidirRecepcion, esHuella, huellasQueFaltan } from '@lilachat/shared';
import { conPlazo, PLAZO_DEL_DISCO_MS } from './plazo.js';
import { DemasiadoGrande } from './disco.js';
import { UserModel } from './models.js';
import { RespaldoModel } from './respaldoModels.js';
import {
  discoDeRespaldos,
  leerEstadoDeCopia,
  nombreDeRespaldoValido,
  rutaDeRespaldo,
} from './respaldoDisco.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { mountBackupAttemptRoutes, recordBackupAttempt } from './backupAttempts.js';

/**
 * Los respaldos de conversaciones que suben los teléfonos (F12.1). El server
 * es un DEPÓSITO: recibe un archivo que no puede abrir, lo guarda en la carpeta
 * del teléfono de la sesión, lo deduplica por huella y lo devuelve al que lo
 * pida con la misma sesión. Contrato calcado del `PUT /archivos` de Lilafotos.
 *
 * - `PUT /`               cuerpo crudo por streaming + `x-huella` + `x-nombre` → 201 guardado · 200 ya_existe · 422 huella_no_coincide · 400 · 507 disco_ausente|disco_colgado
 * - `POST /huellas`       `{huellas[]}` → `{faltan, invalidas}`: el teléfono no gasta datos en lo que ya está
 * - `GET /ultimo`         el más reciente, para el asistente de restaurar
 * - `GET /estado`         disco, copia a la mini y cuántos tengo
 * - `GET /:nombre`        el archivo, entero
 */

/** Cuántos se conservan por persona: el último y el anterior. El historial lo guarda restic. */
const RESPALDOS_QUE_QUEDAN = 2;

/**
 * Tope de un respaldo. Es texto: 20 chats × 1 000 mensajes pesan ~4,6 MB, así
 * que 200 MB es margen de sobra y a la vez un techo para quien mande un cuerpo
 * sin fin. `RESPALDO_MAX_BYTES` lo cambia sin desplegar.
 */
const TOPE_DE_RESPALDO_BYTES = 200 * 1024 * 1024;

function topeDeRespaldo(): number {
  const delEntorno = Number(process.env.RESPALDO_MAX_BYTES);
  return Number.isFinite(delEntorno) && delEntorno > 0 ? delEntorno : TOPE_DE_RESPALDO_BYTES;
}

type Sesion = { userId: Types.ObjectId; telefono: string; emailVerified: boolean };

async function sesionConTelefono(req: Request): Promise<Sesion | null> {
  const userId = req.session!.userId;
  const user = await UserModel.findById(userId).select('phone email emailVerifiedAt').lean<{ phone?: string; email?: string; emailVerifiedAt?: Date } | null>();
  return user?.phone ? { userId, telefono: user.phone, emailVerified: Boolean(user.email && user.emailVerifiedAt) } : null;
}

/** Turning the backup on asks for a verified email (backlog 51); whoever already had backups keeps going. */
async function backupBlockedByEmail(session: Sesion): Promise<boolean> {
  if (session.emailVerified) return false;
  return !(await RespaldoModel.exists({ userId: session.userId }));
}

export function buildRespaldoRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.post(
    '/huellas',
    asyncRoute(async (req, res) => {
      const consultadas = Array.isArray(req.body?.huellas) ? (req.body.huellas as unknown[]).map(String) : [];
      const mias = await RespaldoModel.find({ userId: req.session!.userId }).select('huella').lean();
      res.json(huellasQueFaltan(consultadas, new Set(mias.map((r) => r.huella))));
    })
  );

  router.put('/', asyncRoute(recibirRespaldo));

  router.get(
    '/ultimo',
    asyncRoute(async (req, res) => {
      res.json({ respaldo: await ultimoDe(req.session!.userId) });
    })
  );

  router.get(
    '/estado',
    asyncRoute(async (req, res) => {
      const disco = discoDeRespaldos();
      const [estado, espacio, copia, cantidad, ultimo] = await Promise.all([
        disco.estado(),
        conPlazo(disco.espacio(), PLAZO_DEL_DISCO_MS, null),
        leerEstadoDeCopia(),
        RespaldoModel.countDocuments({ userId: req.session!.userId }),
        ultimoDe(req.session!.userId),
      ]);
      res.json({ disco: { estado, libres: espacio?.libres ?? null, total: espacio?.total ?? null }, copia, cantidad, ultimo });
    })
  );

  // Before `/:nombre`, or «intentos» would be read as a backup's name (pending 83).
  mountBackupAttemptRoutes(router);
  router.get('/:nombre', asyncRoute(bajarRespaldo));

  return router;
}

async function ultimoDe(userId: Types.ObjectId) {
  // `_id` desempata: dos respaldos en el mismo milisegundo dejaban el orden al
  // azar (el test intermitente del 18/10).
  const doc = await RespaldoModel.findOne({ userId }).sort({ creadoEn: -1, _id: -1 }).lean();
  return doc ? { nombre: doc.nombre, huella: doc.huella, bytes: doc.bytes, creadoEn: doc.creadoEn } : null;
}

async function recibirRespaldo(req: Request, res: Response): Promise<void> {
  const huellaDeclarada = String(req.headers['x-huella'] ?? '');
  const nombre = String(req.headers['x-nombre'] ?? '');
  if (!esHuella(huellaDeclarada)) {
    res.status(400).json({ motivo: 'huella_invalida' });
    return;
  }
  if (!nombreDeRespaldoValido(nombre)) {
    res.status(400).json({ motivo: 'nombre_invalido' });
    return;
  }
  const sesion = await sesionConTelefono(req);
  if (!sesion) {
    res.status(401).json({ message: 'Tu sesión venció. Vuelve a entrar.' });
    return;
  }
  if (await backupBlockedByEmail(sesion)) {
    await recordBackupAttempt(sesion.userId, 'correo_sin_verificar');
    res.status(403).json({ motivo: 'correo_sin_verificar', message: 'Verifica tu correo para activar la copia de seguridad.' });
    return;
  }

  // Antes de leer un byte: sin disco no se recibe. 507 y no 500, para que el
  // teléfono lo distinga de un error y lo muestre como «el disco no está».
  const disco = discoDeRespaldos();
  const estado = await disco.estado();
  if (estado !== 'montado') {
    await recordBackupAttempt(sesion.userId, estado === 'ausente' ? 'disco_ausente' : 'disco_colgado');
    res.status(507).json({ motivo: estado === 'ausente' ? 'disco_ausente' : 'disco_colgado' });
    return;
  }

  const maxBytes = topeDeRespaldo();
  if (Number(req.headers['content-length'] ?? 0) > maxBytes) {
    await recordBackupAttempt(sesion.userId, 'demasiado_grande');
    res.status(413).json({ motivo: 'demasiado_grande' });
    return;
  }
  let recibido: Awaited<ReturnType<typeof disco.recibir>>;
  try {
    recibido = await disco.recibir(req, { maxBytes });
  } catch (error) {
    if (!(error instanceof DemasiadoGrande)) throw error;
    await recordBackupAttempt(sesion.userId, 'demasiado_grande');
    res.status(413).json({ motivo: 'demasiado_grande' });
    return;
  }
  if (recibido.bytes === 0) {
    await disco.descartar(recibido.temporal);
    await recordBackupAttempt(sesion.userId, 'vacio');
    res.status(400).json({ motivo: 'vacio' });
    return;
  }

  const yaExiste = Boolean(await RespaldoModel.exists({ userId: sesion.userId, huella: recibido.huella }));
  const decision = decidirRecepcion({ huellaDeclarada, huellaCalculada: recibido.huella, yaExiste });
  if (decision !== 'guardar') {
    await disco.descartar(recibido.temporal);
    await recordBackupAttempt(sesion.userId, decision === 'huella_no_coincide' ? decision : 'ya_existe');
    if (decision === 'huella_no_coincide') res.status(422).json({ motivo: decision });
    else res.status(200).json({ resultado: 'ya_existe', huella: recibido.huella, bytes: recibido.bytes });
    return;
  }

  const relativa = rutaDeRespaldo(sesion.telefono, nombre);
  await disco.mover(recibido.temporal, relativa);
  try {
    await RespaldoModel.create({
      userId: sesion.userId,
      nombre,
      huella: recibido.huella,
      bytes: recibido.bytes,
      creadoEn: new Date(),
    });
  } catch (error) {
    // Carrera: dos subidas del MISMO respaldo entraron a la vez y el índice
    // único frenó a la segunda. El hecho está guardado; esta copia sobra.
    if ((error as { code?: number }).code !== 11000) throw error;
    await disco.eliminar(relativa);
    res.status(200).json({ resultado: 'ya_existe', huella: recibido.huella, bytes: recibido.bytes });
    return;
  }

  await conservarLosUltimos(sesion);
  await recordBackupAttempt(sesion.userId, 'guardado');
  res.status(201).json({ resultado: 'guardado', nombre, huella: recibido.huella, bytes: recibido.bytes });
}

/**
 * Retención en el disco: el último y el anterior. El anterior existe por si el
 * último salió corrupto; más atrás está en los snapshots de restic, que es
 * donde corresponde un historial.
 */
async function conservarLosUltimos(sesion: Sesion): Promise<void> {
  const sobrantes = await RespaldoModel.find({ userId: sesion.userId })
    .sort({ creadoEn: -1, _id: -1 })
    .skip(RESPALDOS_QUE_QUEDAN)
    .lean();
  const disco = discoDeRespaldos();
  for (const sobrante of sobrantes) {
    await disco.eliminar(rutaDeRespaldo(sesion.telefono, sobrante.nombre));
    await RespaldoModel.deleteOne({ _id: sobrante._id });
  }
}

async function bajarRespaldo(req: Request, res: Response): Promise<void> {
  const nombre = String(req.params.nombre ?? '');
  // El mismo 404 para «no existe» y «no es tuyo»: sin diferencia que sondear.
  const doc = nombreDeRespaldoValido(nombre)
    ? await RespaldoModel.findOne({ userId: req.session!.userId, nombre }).lean()
    : null;
  const sesion = doc ? await sesionConTelefono(req) : null;
  if (!doc || !sesion) {
    res.status(404).json({ message: 'No encontramos ese respaldo.' });
    return;
  }

  const disco = discoDeRespaldos();
  if ((await disco.estado()) !== 'montado') {
    res.status(507).json({ motivo: 'disco_ausente' });
    return;
  }
  // Abrir CON PLAZO antes de mandar cabeceras: un archivo que falta es 404 y
  // un disco colgado es 507, en palabras, en vez de un 200 que nunca termina.
  const apertura = open(disco.absoluta(rutaDeRespaldo(sesion.telefono, nombre)), 'r');
  const archivo = await conPlazo<FileHandle | null | 'colgado'>(
    apertura.catch(() => null),
    PLAZO_DEL_DISCO_MS,
    'colgado'
  );
  if (archivo === 'colgado') {
    // Si la apertura llega tarde, se cierra: no queda un descriptor perdido.
    void apertura.then((tarde) => tarde.close()).catch(() => undefined);
    res.status(507).json({ motivo: 'disco_colgado' });
    return;
  }
  if (!archivo) {
    res.status(404).json({ message: 'No encontramos ese respaldo.' });
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(doc.bytes));
  res.setHeader('x-huella', doc.huella);
  try {
    // `pipeline` y no `.pipe`: un error a mitad de camino (disco que se va)
    // cierra los dos lados en vez de tumbar el proceso o dejar al cliente
    // esperando. Ya hay cabeceras: lo único honesto es cortar la conexión.
    await pipeline(archivo.createReadStream(), res);
  } catch (error) {
    console.error('[respaldos] la descarga se cortó:', error instanceof Error ? error.message : error);
    res.destroy();
  }
}
