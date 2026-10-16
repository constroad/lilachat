/**
 * Motor PURO del diagnóstico (rn-app-loop §10): recorte del buffer, forma de
 * las entradas y cuándo toca enviar. Sin React Native, para testear sin
 * emulador. El patrón es el de Lilafotos (`src/nucleo/diagnostico.ts`).
 */
export type EntradaError = { tipo: 'error'; cuando: number; mensaje: string; stack?: string; origen?: string };
export type EntradaPerf = { tipo: 'perf'; cuando: number; op: string; ms: number; extra?: Record<string, number> };
export type EntradaDiagnostico = EntradaError | EntradaPerf;

/** Tope del buffer: lo viejo se cae para que el log nunca crezca sin fin. */
export const MAX_ENTRADAS = 200;
const MENSAJE_MAX = 500;
const STACK_MAX = 2_000;
/** Piso entre dos envíos automáticos: alternar de app no puede spamear. */
export const MIN_ENTRE_ENVIOS_MS = 60_000;

/** Agrega una entrada y recorta a las últimas `max` (las nuevas al final). */
export function agregar(
  buffer: readonly EntradaDiagnostico[],
  entrada: EntradaDiagnostico,
  max = MAX_ENTRADAS
): EntradaDiagnostico[] {
  const siguiente = [...buffer, entrada];
  return siguiente.length > max ? siguiente.slice(siguiente.length - max) : siguiente;
}

/**
 * Tacha lo que no puede salir del teléfono aunque venga pegado a un error:
 * JWTs y números de teléfono. La telemetría es anónima o no se manda.
 */
function tachar(texto: string): string {
  return texto
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]')
    .replace(/\b9\d{8}\b/g, '[teléfono]');
}

/** El error crudo (Error, texto o cualquier cosa) a una entrada acotada y sin datos. */
export function entradaDeError(valor: unknown, origen?: string, ahora = Date.now()): EntradaError {
  const error = valor as { message?: unknown; stack?: unknown } | null;
  const esObjeto = error !== null && typeof error === 'object';
  const mensaje = esObjeto && typeof error.message === 'string' ? error.message : String(valor);
  const stack = esObjeto && typeof error.stack === 'string' ? error.stack : undefined;
  return {
    tipo: 'error',
    cuando: ahora,
    mensaje: tachar(mensaje).slice(0, MENSAJE_MAX),
    ...(stack ? { stack: tachar(stack).slice(0, STACK_MAX) } : {}),
    ...(origen ? { origen } : {}),
  };
}

/** Filtro de lo leído del disco: un log corrupto no puede colar basura al envío. */
export function esEntrada(valor: unknown): valor is EntradaDiagnostico {
  if (typeof valor !== 'object' || valor === null) return false;
  const tipo = (valor as { tipo?: unknown }).tipo;
  return tipo === 'error' || tipo === 'perf';
}

/** Si el envío automático corresponde: hay algo y pasó el piso desde el último. */
export function tocaEnviar(params: { ahora: number; ultimoEnvio: number; cantidad: number }): boolean {
  if (params.cantidad === 0) return false;
  return params.ahora - params.ultimoEnvio >= MIN_ENTRE_ENVIOS_MS;
}
