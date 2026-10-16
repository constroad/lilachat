import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MotivoDeDetencion } from '@lilachat/shared';
import type { DecisionDeCorrida } from './planDeRespaldo';

/**
 * El estado visible del respaldo (F12.1), PERSISTIDO: la pantalla muestra lo
 * último que pasó aunque la corrida haya sido de fondo y hace horas. Un
 * respaldo que dejó de andar en silencio es indistinguible de uno que anda —
 * la lección de Timón y de Lilafotos—, así que acá queda por qué se detuvo.
 */
const CLAVE = 'lilachat.respaldo.estado';

export type EstadoDeRespaldo = {
  ultimaCorridaEn: number | null;
  /** Cuándo se SUBIÓ el último respaldo (no cuándo se intentó). */
  ultimoRespaldoEn: number | null;
  bytesDelUltimo: number | null;
  /** La huella del almacén que quedó respaldada: con eso se sabe si hay algo nuevo. */
  huellaRespaldada: string | null;
  /** La huella del almacén del archivo que se armó y todavía no subió. */
  huellaPendiente: string | null;
  decision: DecisionDeCorrida | null;
  detenidoPor: MotivoDeDetencion | null;
  fallo: string | null;
};

export const ESTADO_INICIAL: EstadoDeRespaldo = {
  ultimaCorridaEn: null,
  ultimoRespaldoEn: null,
  bytesDelUltimo: null,
  huellaRespaldada: null,
  huellaPendiente: null,
  decision: null,
  detenidoPor: null,
  fallo: null,
};

export async function leerEstadoDeRespaldo(): Promise<EstadoDeRespaldo> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    return crudo ? { ...ESTADO_INICIAL, ...(JSON.parse(crudo) as Partial<EstadoDeRespaldo>) } : ESTADO_INICIAL;
  } catch {
    return ESTADO_INICIAL;
  }
}

export async function guardarEstadoDeRespaldo(cambios: Partial<EstadoDeRespaldo>): Promise<EstadoDeRespaldo> {
  const siguiente = { ...(await leerEstadoDeRespaldo()), ...cambios };
  await AsyncStorage.setItem(CLAVE, JSON.stringify(siguiente)).catch(() => undefined);
  return siguiente;
}

export async function olvidarEstadoDeRespaldo(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}
