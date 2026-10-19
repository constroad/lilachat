import { api, type Credential } from '../api';

/**
 * El lado web de vincular con el QR del teléfono (W5, spec §54.4).
 *
 * `clave` es el secreto de ESTA pestaña: con ella se canjea la aprobación.
 * Vive solo en memoria; el QR lleva el `token`, que sí ve cualquiera.
 */
export type Vinculacion = { id: string; clave: string; token: string; rotarCadaMs: number };

export type ResultadoDeEspera =
  | { estado: 'pendiente' }
  | { estado: 'vinculada'; credential: Credential }
  | { estado: 'vencida' }
  | { estado: 'error'; motivo: string; sinRed: boolean };

type RespuestaVinculada = {
  estado: 'vinculada';
  jwt: string;
  deviceId: string;
  user: { id: string; name: string | null; phone: string };
};

export async function iniciarVinculacion(): Promise<{ ok: true; vinculacion: Vinculacion } | { ok: false; motivo: string }> {
  const resultado = await api<Vinculacion>('/auth/vincular/iniciar', { body: {} });
  return resultado.ok ? { ok: true, vinculacion: resultado.data } : { ok: false, motivo: resultado.message };
}

/** El token nuevo, o `null` si la vinculación ya venció (o no hay red). */
export async function rotarCodigo(vinculacion: Vinculacion): Promise<{ token: string } | { vencida: boolean }> {
  const resultado = await api<{ token: string }>('/auth/vincular/rotar', { body: { id: vinculacion.id, clave: vinculacion.clave } });
  if (resultado.ok) return { token: resultado.data.token };
  return { vencida: resultado.status === 410 };
}

/** Espera (long-poll) a que el teléfono apruebe. `mantener` = «Mantener la sesión iniciada». */
export async function esperarVinculacion(vinculacion: Vinculacion, mantener: boolean, signal: AbortSignal): Promise<ResultadoDeEspera> {
  const resultado = await api<{ estado: 'pendiente' } | RespuestaVinculada>('/auth/vincular/esperar', {
    body: { id: vinculacion.id, clave: vinculacion.clave, mantener },
    signal,
  });
  if (!resultado.ok) {
    if (resultado.status === 410) return { estado: 'vencida' };
    return { estado: 'error', motivo: resultado.message, sinRed: resultado.status === 0 };
  }
  if (resultado.data.estado !== 'vinculada') return { estado: 'pendiente' };
  const { jwt, deviceId, user } = resultado.data;
  return { estado: 'vinculada', credential: { jwt, deviceId, userId: user.id, phone: user.phone, name: user.name ?? undefined } };
}
