import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { loadCredential } from '../auth/credentialStore';
import { reportarError } from '../ui/reportarError';
import { decidirSubida, siguienteArchivo, type ArchivoEnCola } from './colaDeArchivosMotor';
import { uploadMedia } from './mediaUpload';
import { alConectar } from './socketClient';

/**
 * La cola de FOTOS, ARCHIVOS y NOTAS DE VOZ, persistida (FL8).
 *
 * Antes se subían directo desde la pantalla del chat: sin red fallaban, la
 * burbuja desaparecía y quedaba un texto rojo; cerrar la app o salir del chat
 * a mitad de subida los perdía. Ahora, como el texto (`outboxStore`), se encola
 * el hecho y sale cuando hay red, desde cualquier pantalla.
 *
 * El archivo se COPIA a la carpeta de la app antes de encolarlo: el `file://`
 * que devuelve la cámara o el selector vive en la caché, y el sistema la
 * limpia — por eso antes una subida pendiente reaparecía como burbuja rota.
 * La copia se borra al subir o al descartar.
 *
 * El JWT NO se guarda en la cola (AsyncStorage no es lugar para secretos): se
 * lee del llavero al momento de subir.
 */
const CLAVE = 'lilachat-cola-archivos';
const CARPETA = `${FileSystem.documentDirectory ?? ''}cola-archivos/`;

let cola: ArchivoEnCola[] = [];
/** 0→1 del archivo que está subiendo ahora. */
let progreso: { clientKey: string; ratio: number } | null = null;
let hidratando: Promise<void> | null = null;
let subiendo = false;
let reintento: ReturnType<typeof setTimeout> | null = null;
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach((oyente) => oyente());

export function suscribirArchivos(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Lo encolado de un chat, con el progreso del que sube. */
export function archivosDelChat(chatId: string): { archivo: ArchivoEnCola; progreso?: number }[] {
  return cola
    .filter((archivo) => archivo.chatId === chatId)
    .map((archivo) => ({ archivo, progreso: progreso?.clientKey === archivo.clientKey ? progreso.ratio : undefined }));
}

async function persistir(): Promise<void> {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(cola)).catch(() => undefined);
}

function hidratar(): Promise<void> {
  if (!hidratando) {
    hidratando = (async () => {
      const crudo = await AsyncStorage.getItem(CLAVE).catch(() => null);
      if (crudo) {
        try {
          cola = [...(JSON.parse(crudo) as ArchivoEnCola[]), ...cola];
        } catch {
          // Un JSON roto no traba la app: se arranca con lo que haya.
        }
      }
      avisar();
    })();
  }
  return hidratando;
}

const extensionDe = (nombre: string) => (nombre.includes('.') ? nombre.slice(nombre.lastIndexOf('.')) : '');

/** Encola un archivo: copia al disco de la app, persiste y empieza a subir. */
export async function encolarArchivo(params: {
  chatId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  caption?: string;
}): Promise<void> {
  await hidratar();
  const clientKey = Crypto.randomUUID();
  await FileSystem.makeDirectoryAsync(CARPETA, { intermediates: true }).catch(() => undefined);
  const copia = `${CARPETA}${clientKey}${extensionDe(params.fileName)}`;
  await FileSystem.copyAsync({ from: params.uri, to: copia });
  cola = [...cola, { ...params, uri: copia, clientKey, queuedAt: new Date().toISOString(), intentos: 0 }];
  avisar();
  await persistir();
  void drenarArchivos();
}

async function sacar(clientKey: string): Promise<void> {
  const archivo = cola.find((uno) => uno.clientKey === clientKey);
  cola = cola.filter((uno) => uno.clientKey !== clientKey);
  if (archivo) await FileSystem.deleteAsync(archivo.uri, { idempotent: true }).catch(() => undefined);
  avisar();
  await persistir();
}

function actualizar(clientKey: string, cambios: Partial<ArchivoEnCola>): void {
  cola = cola.map((uno) => (uno.clientKey === clientKey ? { ...uno, ...cambios } : uno));
}

/** Sube en orden; se corta ante el primer reintento (el orden del chat importa). */
export async function drenarArchivos(): Promise<void> {
  if (subiendo) return;
  subiendo = true;
  try {
    await hidratar();
    for (;;) {
      const archivo = siguienteArchivo(cola);
      if (!archivo) break;
      const credencial = await loadCredential();
      if (!credencial) break;
      const resultado = await uploadMedia({
        token: credencial.jwt,
        chatId: archivo.chatId,
        clientKey: archivo.clientKey,
        uri: archivo.uri,
        fileName: archivo.fileName,
        mimeType: archivo.mimeType,
        sizeBytes: archivo.sizeBytes,
        durationMs: archivo.durationMs,
        caption: archivo.caption,
        onProgress: (ratio) => {
          progreso = { clientKey: archivo.clientKey, ratio };
          avisar();
        },
      });
      progreso = null;
      const decision = decidirSubida(resultado, archivo);
      if (decision.accion === 'confirmar') {
        await sacar(archivo.clientKey);
        continue;
      }
      if (decision.accion === 'fallar') {
        actualizar(archivo.clientKey, { fallo: decision.motivo });
        avisar();
        await persistir();
        continue;
      }
      actualizar(archivo.clientKey, { intentos: archivo.intentos + 1 });
      avisar();
      await persistir();
      programarReintento(decision.esperaMs);
      break;
    }
  } catch (error) {
    reportarError('drenarArchivos', error);
  } finally {
    subiendo = false;
  }
}

function programarReintento(esperaMs: number): void {
  if (reintento) clearTimeout(reintento);
  reintento = setTimeout(() => {
    reintento = null;
    void drenarArchivos();
  }, esperaMs);
}

/** Sale sola al conectar, esté abierto un chat o no. */
alConectar(() => void drenarArchivos());

export async function reintentarArchivo(clientKey: string): Promise<void> {
  cola = cola.map((uno) => {
    if (uno.clientKey !== clientKey) return uno;
    const { fallo: _fallo, ...limpio } = uno;
    return { ...limpio, intentos: 0 };
  });
  avisar();
  await persistir();
  void drenarArchivos();
}

export const descartarArchivo = (clientKey: string): Promise<void> => sacar(clientKey);

/** Al cerrar sesión: lo que quedó sin subir es de quien se fue. */
export async function olvidarArchivos(): Promise<void> {
  cola = [];
  progreso = null;
  if (reintento) clearTimeout(reintento);
  reintento = null;
  avisar();
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
  await FileSystem.deleteAsync(CARPETA, { idempotent: true }).catch(() => undefined);
}
