import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import { PREFIJO_DE_VINCULADO } from '@lilachat/shared';
import { DeviceModel } from './models.js';

/**
 * Las webs vinculadas con el QR (W5, spec §54.4). Son NUESTRAS: constroad-auth
 * no las conoce. El secreto se genera acá, viaja una vez en la cookie y queda
 * solo su hash.
 *
 * Revocar tiene que pegar YA, no cuando venza el JWT (24 h): toda ruta con
 * sesión de una vinculada pregunta si sigue vigente. La respuesta se recuerda
 * un minuto (una lectura por minuto por web activa) y de paso anota el último
 * uso que muestra el teléfono. Revocar la marca vencida en el acto.
 */
const RECORDAR_VIGENCIA_MS = 60_000;
const BYTES_DEL_SECRETO = 32;

const hashDe = (secreto: string): string => createHash('sha256').update(secreto).digest('hex');
const vigencias = new Map<string, { vigente: boolean; hasta: number }>();

export type DispositivoVinculado = { deviceId: string; nombre: string; ultimoUso: Date | null; vinculadoEn: Date | null };

export async function crearDispositivoVinculado(params: {
  userId: Types.ObjectId | string;
  aprobadoPor: string;
  nombre: string;
  temporal: boolean;
}): Promise<{ deviceId: string; secreto: string }> {
  const deviceId = `${PREFIJO_DE_VINCULADO}${randomUUID()}`;
  const secreto = randomBytes(BYTES_DEL_SECRETO).toString('base64url');
  await DeviceModel.create({
    deviceId,
    userId: params.userId,
    platform: 'web',
    vinculadoPor: params.aprobadoPor,
    secretoHash: hashDe(secreto),
    nombre: params.nombre,
    sesionTemporal: params.temporal,
    lastSeenAt: new Date(),
  });
  vigencias.delete(deviceId);
  return { deviceId, secreto };
}

export const contarVinculados = (userId: Types.ObjectId | string): Promise<number> =>
  DeviceModel.countDocuments({ userId, vinculadoPor: { $exists: true } });

/** El dueño de una vinculada si el secreto coincide; `null` si no existe o no coincide. */
export async function validarVinculado(deviceId: string, secreto: string): Promise<{ userId: Types.ObjectId; temporal: boolean } | null> {
  const vinculado = await DeviceModel.findOne({ deviceId, vinculadoPor: { $exists: true } }).select('userId secretoHash sesionTemporal').lean();
  if (!vinculado?.secretoHash) return null;
  const esperado = Buffer.from(vinculado.secretoHash, 'hex');
  const recibido = Buffer.from(hashDe(secreto), 'hex');
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  return { userId: vinculado.userId, temporal: Boolean(vinculado.sesionTemporal) };
}

/** ¿Sigue vinculada? Recordado un minuto; cada lectura real anota el último uso. */
export async function vinculadoVigente(deviceId: string): Promise<boolean> {
  const recordada = vigencias.get(deviceId);
  if (recordada && recordada.hasta > Date.now()) return recordada.vigente;
  const vinculado = await DeviceModel.findOneAndUpdate({ deviceId, vinculadoPor: { $exists: true } }, { $set: { lastSeenAt: new Date() } })
    .select('_id')
    .lean();
  vigencias.set(deviceId, { vigente: Boolean(vinculado), hasta: Date.now() + RECORDAR_VIGENCIA_MS });
  return Boolean(vinculado);
}

/** Borra la vinculada de ESE usuario. `false` si no era suya o no era vinculada. */
export async function revocarVinculado(userId: Types.ObjectId | string, deviceId: string): Promise<boolean> {
  const borrado = await DeviceModel.findOneAndDelete({ deviceId, userId, vinculadoPor: { $exists: true } }).select('_id').lean();
  if (borrado) vigencias.set(deviceId, { vigente: false, hasta: Date.now() + RECORDAR_VIGENCIA_MS });
  return Boolean(borrado);
}

export async function listarVinculados(userId: Types.ObjectId | string): Promise<DispositivoVinculado[]> {
  const filas = await DeviceModel.find({ userId, vinculadoPor: { $exists: true } })
    .select('deviceId nombre lastSeenAt createdAt')
    .sort({ lastSeenAt: -1 })
    .lean<{ deviceId: string; nombre?: string; lastSeenAt?: Date; createdAt?: Date }[]>();
  return filas.map((fila) => ({
    deviceId: fila.deviceId,
    nombre: fila.nombre ?? 'Navegador',
    ultimoUso: fila.lastSeenAt ?? null,
    vinculadoEn: fila.createdAt ?? null,
  }));
}
