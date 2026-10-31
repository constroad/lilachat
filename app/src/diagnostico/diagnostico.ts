import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { agregar, entradaDeError, esEntrada, MAX_ENTRADAS, tocaEnviar, type EntradaDiagnostico } from './motor';

/**
 * Diagnóstico a LilaStore (rn-app-loop §10; patrón de Lilafotos): errores y
 * tiempos de ESTE teléfono en un buffer rotativo, que se sube solo como un
 * crash-reporter. Nada personal: ni tokens, ni teléfonos, ni mensajes.
 *
 * Existe para MEDIR la fluidez (spec §45, FL0): sin cifras, «se siente lenta»
 * solo se puede creer, no comparar antes y después.
 */
const CLAVE = 'lilachat.diagnostico';
const CLAVE_INSTALL = 'lilachat.diagnostico.install';
const TIENDA = 'https://lilastore.constroad.com';
/** El slug de la app en LilaStore = el de `app.json`. */
const SLUG = 'lilachat';
const PAUSA_DE_GUARDADO_MS = 400;
const PLAZO_DE_ENVIO_MS = 12_000;

let buffer: EntradaDiagnostico[] = [];
let cargado = false;

async function asegurarCargado(): Promise<void> {
  if (cargado) return;
  cargado = true;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    const leido: unknown = crudo ? JSON.parse(crudo) : null;
    if (Array.isArray(leido)) buffer = leido.filter(esEntrada).slice(-MAX_ENTRADAS);
  } catch {
    // Un log corrupto no puede tumbar la app: arranca vacío.
  }
}

let guardando: Promise<void> | null = null;
/** Se agrupa: no se escribe en disco en cada evento. */
function persistir(): void {
  if (guardando) return;
  guardando = (async () => {
    await new Promise((resolver) => setTimeout(resolver, PAUSA_DE_GUARDADO_MS));
    const copia = buffer;
    guardando = null;
    await AsyncStorage.setItem(CLAVE, JSON.stringify(copia)).catch(() => undefined);
  })();
}

export async function registrarError(valor: unknown, origen?: string): Promise<void> {
  await asegurarCargado();
  buffer = agregar(buffer, entradaDeError(valor, origen));
  persistir();
}

export async function registrarPerf(op: string, ms: number, extra?: Record<string, number>): Promise<void> {
  await asegurarCargado();
  buffer = agregar(buffer, { tipo: 'perf', cuando: Date.now(), op, ms: Math.round(ms), ...(extra ? { extra } : {}) });
  persistir();
}

/** Cronómetro de una operación async: anota cuánto tardó, pase lo que pase. */
export async function medir<T>(op: string, tarea: () => Promise<T>, extra?: Record<string, number>): Promise<T> {
  const inicio = Date.now();
  try {
    return await tarea();
  } finally {
    void registrarPerf(op, Date.now() - inicio, extra);
  }
}

type ManejadorGlobal = (error: unknown, fatal?: boolean) => void;
type UtilidadesDeError = { getGlobalHandler?: () => ManejadorGlobal; setGlobalHandler?: (h: ManejadorGlobal) => void };

/**
 * Todo error sin atrapar queda en el log y sigue al manejador de antes.
 * `alServidor` (31/10) also sends it to /api/crash: a fatal one used to stay
 * only in this local log, so «the app closes» left no trace on the server.
 */
export function instalarCapturaGlobal(alServidor?: (pantalla: string, error: unknown) => void): void {
  const utilidades = (globalThis as { ErrorUtils?: UtilidadesDeError }).ErrorUtils;
  if (!utilidades?.setGlobalHandler) return;
  const anterior = utilidades.getGlobalHandler?.();
  utilidades.setGlobalHandler((error, fatal) => {
    const pantalla = fatal ? 'fatal' : 'global';
    void registrarError(error, pantalla);
    alServidor?.(pantalla, error);
    anterior?.(error, fatal);
  });
}

export async function leerDiagnostico(): Promise<EntradaDiagnostico[]> {
  await asegurarCargado();
  return [...buffer];
}

export async function limpiarDiagnostico(): Promise<void> {
  buffer = [];
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}

/** Id de instalación ANÓNIMO: agrupa los reportes de este teléfono, no identifica a nadie. */
async function idDeInstalacion(): Promise<string> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_INSTALL);
    if (guardado) return guardado;
  } catch {
    // Sigue y genera uno.
  }
  const nuevo = Crypto.randomUUID();
  await AsyncStorage.setItem(CLAVE_INSTALL, nuevo).catch(() => undefined);
  return nuevo;
}

export type EnvioDiagnostico = { ok: true } | { ok: false; motivo: 'vacio' | 'sin_red' | 'rechazado' };

/** Manda el buffer a LilaStore. No borra nada local: se puede reintentar. */
export async function enviarDiagnostico(): Promise<EnvioDiagnostico> {
  const entradas = await leerDiagnostico();
  if (entradas.length === 0) return { ok: false, motivo: 'vacio' };
  const cuerpo = {
    slug: SLUG,
    installId: await idDeInstalacion(),
    version: Constants.expoConfig?.version ?? '',
    versionCode: Constants.expoConfig?.android?.versionCode ?? 0,
    plataforma: 'android',
    entradas,
  };
  try {
    const respuesta = await fetch(`${TIENDA}/api/v1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(PLAZO_DE_ENVIO_MS),
    });
    return respuesta.ok ? { ok: true } : { ok: false, motivo: 'rechazado' };
  } catch {
    return { ok: false, motivo: 'sin_red' };
  }
}

/**
 * Trabas del hilo de JS: un tic cada 500 ms que llega tarde es el hilo ocupado
 * ese tiempo — es lo que se siente como «la app se traba». Una entrada
 * `hilo-js` por minuto con la peor traba y cuántas hubo. Solo con la app al
 * frente: atrás no gasta.
 */
const TIC_MS = 500;
const TRABA_MS = 250;
const VENTANA_TRABAS_MS = 60_000;

export function instalarDetectorDeTrabas(): void {
  let reloj: ReturnType<typeof setInterval> | null = null;
  let esperado = 0;
  let desde = 0;
  let trabas = 0;
  let peor = 0;

  const tic = () => {
    const ahora = Date.now();
    const atraso = ahora - esperado;
    esperado = ahora + TIC_MS;
    if (atraso > TRABA_MS) {
      trabas += 1;
      peor = Math.max(peor, atraso);
    }
    if (ahora - desde < VENTANA_TRABAS_MS) return;
    if (trabas > 0) void registrarPerf('hilo-js', peor, { trabas });
    trabas = 0;
    peor = 0;
    desde = ahora;
  };
  const encender = () => {
    if (reloj) return;
    esperado = Date.now() + TIC_MS;
    desde = Date.now();
    reloj = setInterval(tic, TIC_MS);
  };
  const apagar = () => {
    if (reloj) clearInterval(reloj);
    reloj = null;
  };
  AppState.addEventListener('change', (estado) => (estado === 'active' ? encender() : apagar()));
  if (AppState.currentState === 'active') encender();
}

let ultimoEnvio = 0;

async function enviarSiCorresponde(): Promise<void> {
  const entradas = await leerDiagnostico();
  const ahora = Date.now();
  if (!tocaEnviar({ ahora, ultimoEnvio, cantidad: entradas.length })) return;
  ultimoEnvio = ahora;
  await enviarDiagnostico().catch(() => undefined);
}

/**
 * Envío AUTOMÁTICO (decisión de José, 15/10/2026, para toda app RN): al pasar
 * a segundo plano y una vez al arrancar. Nada de polling con temporizador.
 */
export function instalarEnvioAutomatico(): void {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'background' || estado === 'inactive') void enviarSiCorresponde();
  });
  void enviarSiCorresponde();
}

/** Cuándo arrancó el proceso: la base de «arranque hasta la lista». */
export const inicioDelProceso = Date.now();

const cronometros = new Map<string, number>();
const medidasUnicas = new Set<string>();

/** Arranca un cronómetro que termina en otra pantalla (tocar un chat → verlo). */
export function iniciarCronometro(nombre: string): void {
  cronometros.set(nombre, Date.now());
}

/** Lo cierra y anota el tiempo. Sin un inicio pendiente no anota nada. */
export function terminarCronometro(nombre: string, extra?: Record<string, number>): void {
  const inicio = cronometros.get(nombre);
  if (inicio === undefined) return;
  cronometros.delete(nombre);
  void registrarPerf(nombre, Date.now() - inicio, extra);
}

/** Una medida que vale una sola vez por proceso (el arranque). */
export function medirUnaVez(nombre: string, desde: number, extra?: Record<string, number>): void {
  if (medidasUnicas.has(nombre)) return;
  medidasUnicas.add(nombre);
  void registrarPerf(nombre, Date.now() - desde, extra);
}
