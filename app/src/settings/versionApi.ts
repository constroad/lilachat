import Constants from 'expo-constants';
import { resultadoDelChequeo, type ResultadoDelChequeo } from './actualizacion';

/**
 * Preguntarle a LilaStore si hay una versión más nueva de ESTA app.
 *
 * Va contra `/api/v1/apps/:slug/min-version`, que **no está autenticado**: la
 * app no es un dispositivo enrolado en la tienda y exigirle una credencial haría
 * imposible el único mecanismo por el que alguien se entera de que tiene que
 * actualizar. De una app privada el endpoint no informa nada, y eso se traduce
 * en «no se pudo verificar», no en «estás al día».
 *
 * Sirve tal cual para cualquier otra app RN nuestra: solo cambia el `slug`.
 */
const TIENDA = 'https://lilastore.constroad.com';
const SLUG = 'lilachat';
const TIMEOUT_MS = 8_000;

/** El `versionCode` de este build. `0` si no se pudo leer. */
export function versionCodeActual(): number {
  const valor = Constants.expoConfig?.android?.versionCode;
  return typeof valor === 'number' ? valor : 0;
}

export const versionActual = (): string => Constants.expoConfig?.version ?? '';

export async function buscarActualizacion(): Promise<{
  resultado: ResultadoDelChequeo;
  /** De dónde bajarla. Vacío si el server no la ofrece. */
  downloadUrl: string;
  /** El `versionCode` publicado; `null` si no hubo respuesta. */
  ultima: number | null;
  /** El mínimo exigido; `0` si no hay. Por debajo, la app no sirve. */
  minima: number;
  /** La versión legible de la publicada. */
  version: string;
}> {
  try {
    const respuesta = await fetch(`${TIENDA}/api/v1/apps/${SLUG}/min-version`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const datos = (await respuesta.json()) as Record<string, unknown>;

    const ultima =
      typeof datos.latestVersionCode === 'number' && datos.latestVersionCode > 0
        ? datos.latestVersionCode
        : null;

    const version = typeof datos.latestVersion === 'string' ? datos.latestVersion : '';
    return {
      resultado: resultadoDelChequeo({ actual: versionCodeActual(), ultima, version }),
      downloadUrl: typeof datos.downloadUrl === 'string' ? datos.downloadUrl : '',
      ultima,
      minima: typeof datos.minVersionCode === 'number' ? datos.minVersionCode : 0,
      version,
    };
  } catch {
    // Sin red no se afirma nada: «no se pudo» ≠ «estás al día».
    return { resultado: { estado: 'no-se-pudo' }, downloadUrl: '', ultima: null, minima: 0, version: '' };
  }
}
