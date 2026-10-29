import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { loadCredential } from '../auth/credentialStore';
import { reportarError } from '../ui/reportarError';
import { decidirSubida, paraPersistir, siguienteArchivo, type ArchivoEnCola } from './colaDeArchivosMotor';
import { uploadMedia, type SealedUpload } from './mediaUpload';
import { createMediaKey, serializeMediaSecret, validateMedia, type Envelope } from '@lilachat/shared';
import { File } from 'expo-file-system';
import { sealFile } from '../crypto/sealedFiles';
import { rememberOpened } from './secretMediaFiles';
import type { ServerMessage } from './socketClient';
import { alConectar } from './socketClient';
import { valeAvisarProgreso } from './progresoDeSubida';
import { shrinkPhotoFile } from './shrinkPhoto';

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

/** Photos, files and voice notes still waiting to upload: an OTA reload must not happen while any is pending. */
export function pendingFilesCount(): number {
  return cola.length;
}

/** Lo encolado de un chat, con el progreso del que sube. */
export function archivosDelChat(chatId: string): { archivo: ArchivoEnCola; progreso?: number }[] {
  return cola
    .filter((archivo) => archivo.chatId === chatId)
    .map((archivo) => ({ archivo, progreso: progreso?.clientKey === archivo.clientKey ? progreso.ratio : undefined }));
}

async function persistir(): Promise<void> {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(paraPersistir(cola))).catch(() => undefined);
}

/**
 * La copia local de lo que YA subió, en esta sesión (auditoría 19/10): la
 * burbuja confirmada la sigue mostrando en vez de bajar la foto que acabo de
 * mandar (parpadeaba). Al reiniciar se limpia (`limpiarHuerfanas`).
 */
const copiasConfirmadas = new Map<string, string>();

export function copiaLocalDe(clientKey: string): string | undefined {
  return copiasConfirmadas.get(clientKey);
}

/**
 * The key of each open secret chat (pending 67): its photos and videos go up
 * encrypted. Without it a file goes as it is, and the server refuses a plain
 * file in a secret chat before storing it.
 */
const sealsByChat = new Map<string, (text: string) => Envelope | null>();

/** Registered by the chat while its key is ready; the returned function forgets it. */
export function registerChatSeal(chatId: string, seal: ((text: string) => Envelope | null) | undefined): () => void {
  if (!seal) return () => undefined;
  sealsByChat.set(chatId, seal);
  return () => {
    if (sealsByChat.get(chatId) === seal) sealsByChat.delete(chatId);
  };
}

/** Quien pinta el chat recibe el mensaje confirmado ANTES de que se quite la burbuja pendiente. */
const oyentesDeConfirmados = new Set<(mensaje: ServerMessage) => void>();

export function suscribirConfirmados(oyente: (mensaje: ServerMessage) => void): () => void {
  oyentesDeConfirmados.add(oyente);
  return () => oyentesDeConfirmados.delete(oyente);
}

/** Al arrancar: lo que quedó en la carpeta y ya no está en la cola, se borra. */
async function limpiarHuerfanas(): Promise<void> {
  const archivos = await FileSystem.readDirectoryAsync(CARPETA).catch(() => [] as string[]);
  // Se mira la cola AL BORRAR, por clave: una foto encolada mientras tanto ya
  // está copiándose acá y no es huérfana.
  const enUso = (nombre: string) => cola.some((archivo) => nombre.startsWith(archivo.clientKey)) || [...copiasConfirmadas.keys()].some((clave) => nombre.startsWith(clave));
  await Promise.all(
    archivos.filter((nombre) => !enUso(nombre)).map((nombre) => FileSystem.deleteAsync(`${CARPETA}${nombre}`, { idempotent: true }).catch(() => undefined))
  );
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
      void limpiarHuerfanas();
    })();
  }
  return hidratando;
}

const extensionDe = (nombre: string) => (nombre.includes('.') ? nombre.slice(nombre.lastIndexOf('.')) : '');

/** Encola un archivo: copia al disco de la app, persiste y empieza a subir. */
type ArchivoNuevo = {
  chatId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  caption?: string;
  width?: number;
  height?: number;
  onda?: number[];
  albumId?: string;
};

/**
 * Encola un archivo: la burbuja YA, con la uri original (auditoría 19/10:
 * aparecía recién copiada, y de a una), y en segundo plano se prepara —la foto
 * se comprime salvo `hd` (José, 19/10) y se copia a la carpeta de la app—.
 * Se sube cuando está lista.
 */
export async function encolarArchivo(params: ArchivoNuevo & { hd?: boolean }): Promise<void> {
  await hidratar();
  const { hd, ...archivo } = params;
  const seal = sealsByChat.get(archivo.chatId);
  const clientKey = Crypto.randomUUID();
  cola = [...cola, { ...archivo, clientKey, queuedAt: new Date().toISOString(), intentos: 0, preparando: true }];
  avisar();
  let preparado: Prepared;
  try {
    preparado = await prepararArchivo(archivo, clientKey, Boolean(hd));
    if (seal) preparado = { ...preparado, sealed: await sealPrepared(preparado, archivo, clientKey, seal) };
  } catch (error) {
    cola = cola.filter((uno) => uno.clientKey !== clientKey);
    avisar();
    throw error;
  }
  // Descartada mientras se preparaba: la copia sobra.
  if (!cola.some((uno) => uno.clientKey === clientKey)) {
    await FileSystem.deleteAsync(preparado.uri, { idempotent: true }).catch(() => undefined);
    if (preparado.sealed) await FileSystem.deleteAsync(preparado.sealed.uri, { idempotent: true }).catch(() => undefined);
    return;
  }
  actualizar(clientKey, { ...preparado, preparando: false });
  avisar();
  await persistir();
  void drenarArchivos();
}

/** La foto comprimida (o el archivo tal cual), ya en la carpeta de la app. */
async function prepararArchivo(archivo: ArchivoNuevo, clientKey: string, hd: boolean) {
  // Portal's standard (28/10): a photo of 1 MB or more goes lighter; anything else, «HD» or a failure, as it is.
  const isImage = archivo.mimeType.startsWith('image/');
  const shrunk = isImage ? await shrinkPhotoFile(archivo, { hd }) : null;
  const fuente = shrunk ?? { uri: archivo.uri, fileName: archivo.fileName, mimeType: archivo.mimeType, sizeBytes: archivo.sizeBytes, width: archivo.width, height: archivo.height };
  const temporal = shrunk?.temporary === true;
  await FileSystem.makeDirectoryAsync(CARPETA, { intermediates: true }).catch(() => undefined);
  const destino = `${CARPETA}${clientKey}${extensionDe(fuente.fileName)}`;
  await (temporal ? FileSystem.moveAsync({ from: fuente.uri, to: destino }) : FileSystem.copyAsync({ from: fuente.uri, to: destino }));
  return { ...fuente, uri: destino, sizeBytes: await knownSize(destino, fuente.sizeBytes) };
}

type Prepared = Awaited<ReturnType<typeof prepararArchivo>> & { sealed?: SealedUpload };

/**
 * A secret chat's photo or video (pending 67): encrypted next to its plain
 * copy with a key of its own, and that key sealed end to end in the text.
 * Photos, videos, voice notes and documents (pending 118), never in clear: a
 * seal that fails stops it.
 */
async function sealPrepared(prepared: Prepared, original: Pick<ArchivoNuevo, 'caption' | 'durationMs' | 'onda'>, clientKey: string, seal: (text: string) => Envelope | null): Promise<SealedUpload> {
  const validation = validateMedia({ mimeType: prepared.mimeType, sizeBytes: prepared.sizeBytes });
  if (!validation.ok) throw new Error(validation.reason);
  const key = createMediaKey();
  const envelope = seal(serializeMediaSecret({ key, mime: prepared.mimeType, fileName: prepared.fileName, sizeBytes: prepared.sizeBytes, width: prepared.width, height: prepared.height, durationMs: original.durationMs, waveform: original.onda?.length ? original.onda : undefined, caption: original.caption?.trim() || undefined }));
  if (!envelope) throw new Error('No se pudo cifrar el archivo.');
  const target = new File(`${CARPETA}${clientKey}.sellado`);
  const sizeBytes = await sealFile(new File(prepared.uri), target, key);
  return { uri: target.uri, sizeBytes, envelope, kind: validation.kind };
}

/**
 * The real size when the source did not say it: the clip's gallery (20/10)
 * lists files without a size, and a 0 failed as an «empty file».
 */
async function knownSize(uri: string, reported: number): Promise<number> {
  if (reported > 0) return reported;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory ? info.size : 0;
}

async function sacar(clientKey: string, opciones: { confirmado?: boolean } = {}): Promise<void> {
  const archivo = cola.find((uno) => uno.clientKey === clientKey);
  cola = cola.filter((uno) => uno.clientKey !== clientKey);
  // Lo que subió conserva su copia para la burbuja; lo descartado, no.
  if (archivo && opciones.confirmado && !archivo.preparando) copiasConfirmadas.set(clientKey, archivo.uri);
  else if (archivo && !archivo.preparando) await FileSystem.deleteAsync(archivo.uri, { idempotent: true }).catch(() => undefined);
  // The encrypted copy only had to go up.
  if (archivo?.sealed) await FileSystem.deleteAsync(archivo.sealed.uri, { idempotent: true }).catch(() => undefined);
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
        width: archivo.width,
        height: archivo.height,
        onda: archivo.onda,
        albumId: archivo.albumId,
        sealed: archivo.sealed,
        onProgress: (ratio) => {
          const avisado = progreso?.clientKey === archivo.clientKey ? progreso.ratio : null;
          // Por pasos visibles (FL12): cada aviso redibuja la pantalla del chat.
          if (!valeAvisarProgreso(avisado, ratio)) return;
          progreso = { clientKey: archivo.clientKey, ratio };
          avisar();
        },
      });
      progreso = null;
      const decision = decidirSubida(resultado, archivo);
      if (decision.accion === 'confirmar') {
        // Primero el confirmado al chat, después se quita la pendiente: sin
        // hueco aunque el socket esté caído (auditoría 19/10).
        const confirmado = resultado.ok ? resultado.mensaje : undefined;
        // My own sealed photo is already on the phone: the bubble does not wait to download and decrypt it.
        if (resultado.ok && archivo.sealed) rememberOpened(resultado.url, archivo.mimeType, archivo.uri);
        if (confirmado) oyentesDeConfirmados.forEach((oyente) => oyente(confirmado));
        await sacar(archivo.clientKey, { confirmado: true });
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
  copiasConfirmadas.clear();
  progreso = null;
  if (reintento) clearTimeout(reintento);
  reintento = null;
  avisar();
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
  await FileSystem.deleteAsync(CARPETA, { idempotent: true }).catch(() => undefined);
}
