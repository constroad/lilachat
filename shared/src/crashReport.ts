/**
 * Reportar los errores de las apps RN, para que dejen de ser invisibles.
 *
 * Nace del 26/08/2026: un botón no hacía nada y **no había forma de enterarse**
 * — ni en el teléfono, ni en el server, ni en Torre. Un fallo que solo ve quien
 * lo sufre es un fallo que se arregla cuando alguien se acuerda de contarlo.
 *
 * Lo que este motor cuida es qué NO viaja. Un reporte de error es la vía más
 * fácil para que datos privados terminen en un log: un mensaje del chat metido
 * en un stack, un teléfono, un token. Por eso los topes son duros y no dependen
 * de que quien lanzó el error se haya portado bien.
 */

/** Las apps que pueden reportar. El endpoint no está autenticado (ver abajo). */
export const APPS_QUE_REPORTAN = ['lilachat', 'lilastore', 'timon'] as const;

const MAX_MENSAJE = 500;
const MAX_LINEAS_STACK = 20;

export type CrashReport = {
  app: string;
  version: string;
  plataforma: string;
  /** Dónde pasó. Un nombre de pantalla, no una ruta con datos adentro. */
  pantalla: string;
  mensaje: string;
  stack: string;
  enviadoEn: string;
};

export function armarReporte(params: {
  app: string;
  version: string;
  plataforma: string;
  pantalla: string;
  error: unknown;
  enviadoEn: string;
}): CrashReport {
  const { error } = params;

  const mensaje =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  // El stack completo de Hermes son cientos de líneas de `node_modules`; lo
  // único que sirve son las primeras.
  const stack =
    error instanceof Error && error.stack
      ? error.stack.split('\n').slice(0, MAX_LINEAS_STACK).join('\n')
      : '';

  return {
    app: params.app,
    version: params.version,
    plataforma: params.plataforma,
    pantalla: params.pantalla,
    mensaje: mensaje.slice(0, MAX_MENSAJE),
    stack,
    enviadoEn: params.enviadoEn,
  };
}

/**
 * Valida lo que llega al endpoint.
 *
 * **No está autenticado a propósito:** una app que revienta al arrancar no
 * tiene sesión que presentar, y es justo el caso que más importa ver. A cambio,
 * el `app` se compara contra una lista cerrada: sin eso cualquiera llena el log
 * con lo que quiera y con el nombre que quiera.
 */
export function esReporteValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const dato = valor as Record<string, unknown>;

  const texto = (campo: unknown) => typeof campo === 'string' && campo.trim().length > 0;

  return (
    texto(dato.app) &&
    APPS_QUE_REPORTAN.includes(dato.app as (typeof APPS_QUE_REPORTAN)[number]) &&
    texto(dato.version) &&
    texto(dato.mensaje)
  );
}
