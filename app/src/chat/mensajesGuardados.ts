import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import {
  abrirCache,
  bytesToBase64,
  base64ToBytes,
  cederAlHilo,
  cerrarCache,
  conciliarPagina,
  crearColaSerial,
  porLotes,
  seqsQueSobran,
  type Envelope,
} from '@lilachat/shared';
import type { ChatMessage } from './useChat';
import { chatIdsAMigrar, PREFIJO_CACHE_VIEJA } from './migracionDeCache';

/**
 * El almacén de mensajes del teléfono (F12.0): SQLite, una fila por mensaje,
 * CIFRADA en reposo. Es la copia completa, no una caché.
 *
 * Hasta el 15/09/2026 era un blob por chat en AsyncStorage con los últimos 60
 * mensajes. Con el cifrado por defecto (F12.3) el server deja de poder leer las
 * conversaciones, así que el historial entero tiene que vivir acá — y de acá
 * sale el respaldo (F12.1). SQLite y no un JSON por el mismo motivo que el
 * libro de Lilafotos: son miles de filas que cambian de a una, y reescribir un
 * archivo entero por cada mensaje anda bien con 60 y mal con 20 000.
 *
 * **Solo `chatId` y `seq` van en claro** —lo mínimo para ordenar, paginar y
 * encontrar huecos—; el mensaje entero viaja dentro del sobre. Guardar autor o
 * fecha en columnas sería regalar los metadatos de la familia a cualquier app
 * con permiso de archivos.
 *
 * **La clave vive en `expo-secure-store`** con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`:
 * el mismo criterio que la credencial de sesión. Al lado de la base —que es un
 * archivo legible— iría la caja fuerte junto a su llave.
 *
 * **Nada de esto lanza.** Un almacén que no se pudo leer cuesta esperar a la
 * red; que el chat no abra por un archivo corrupto sería mucho peor.
 */
const CLAVE_SECRETA = 'lilachat.cacheKey';
const NOMBRE_BASE = 'lilachat.db';

const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type Fila = { seq: number; sobre: string };

let base: SQLite.SQLiteDatabase | null = null;
let clavePrometida: Promise<Uint8Array | null> | null = null;
let migracion: Promise<void> | null = null;

/**
 * Toda escritura pasa por UNA cola: SQLite admite una transacción por conexión,
 * y dos a la vez (hidratador + `msg.new`) terminaban con el `ROLLBACK` de la
 * segunda deshaciendo a la primera (`colaSerial.ts`).
 */
const enCola = crearColaSerial();

/**
 * Sube al cerrar sesión. Una escritura encolada ANTES de olvidar —un mensaje que
 * llegó justo al salir— no se aplica después: crearía una clave nueva y dejaría
 * filas del anterior legibles para quien entre en este teléfono.
 */
let generacion = 0;

/** La clave del almacén; se crea la primera vez y no cambia hasta cerrar sesión. */
function claveDeCache(): Promise<Uint8Array | null> {
  if (!clavePrometida) {
    clavePrometida = (async () => {
      try {
        const guardada = await SecureStore.getItemAsync(CLAVE_SECRETA, OPCIONES);
        if (guardada) return base64ToBytes(guardada);

        const nueva = Crypto.getRandomBytes(32);
        await SecureStore.setItemAsync(CLAVE_SECRETA, bytesToBase64(nueva), OPCIONES);
        return nueva;
      } catch {
        // Sin llavero no se guarda nada: preferible perder el almacén a escribir
        // los mensajes en claro.
        return null;
      }
    })();
  }
  return clavePrometida;
}

function abrirBase(): SQLite.SQLiteDatabase {
  if (base) return base;
  base = SQLite.openDatabaseSync(NOMBRE_BASE);
  base.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mensajes (
      chatId TEXT NOT NULL,
      seq INTEGER NOT NULL,
      sobre TEXT NOT NULL,
      PRIMARY KEY (chatId, seq)
    );
  `);
  return base;
}

/**
 * Abrir la base y, la primera vez, volcar la caché vieja. Todo lo público pasa
 * por acá, así que la migración corre una sola vez por proceso y antes de
 * cualquier lectura — sin eso, abrir un chat migrado a medias mostraría menos
 * de lo que ya se tenía.
 */
async function listo(): Promise<SQLite.SQLiteDatabase | null> {
  try {
    const abierta = abrirBase();
    if (!migracion) migracion = migrarCacheVieja(abierta);
    await migracion;
    return abierta;
  } catch {
    return null;
  }
}

/**
 * De `lilachat.msgs.<chatId>` (AsyncStorage, blob cifrado con los últimos 60)
 * a filas. Idempotente por construcción: cada clave se borra al terminar de
 * volcarla, así que una migración cortada a la mitad sigue donde quedó.
 */
async function migrarCacheVieja(abierta: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const chatIds = chatIdsAMigrar(await AsyncStorage.getAllKeys());
    if (chatIds.length === 0) return;
    const clave = await claveDeCache();
    if (!clave) return;

    for (const chatId of chatIds) {
      const claveVieja = `${PREFIJO_CACHE_VIEJA}${chatId}`;
      const crudo = await AsyncStorage.getItem(claveVieja);
      const mensajes = crudo ? abrirCache<ChatMessage[]>(clave, JSON.parse(crudo)) : null;
      if (Array.isArray(mensajes)) await escribirFilas(abierta, clave, chatId, mensajes);
      await AsyncStorage.removeItem(claveVieja);
    }
  } catch {
    // Una caché vieja que no se pudo migrar no vale una app que no abre: lo
    // que falte vuelve del server.
  }
}

async function escribirFilas(
  abierta: SQLite.SQLiteDatabase,
  clave: Uint8Array,
  chatId: string,
  mensajes: readonly ChatMessage[],
  deEstaSesion: number = generacion,
  conflicto: 'REPLACE' | 'IGNORE' = 'REPLACE'
): Promise<number> {
  const filas = mensajes.map((mensaje) => ({
    seq: mensaje.seq,
    sobre: JSON.stringify(cerrarCache(clave, mensaje)),
  }));
  let escritas = 0;
  await enCola(async () => {
    if (deEstaSesion !== generacion) return;
    await abrirTransaccion(abierta, async () => {
      for (const fila of filas) {
        const { changes } = await abierta.runAsync(
          `INSERT OR ${conflicto} INTO mensajes (chatId, seq, sobre) VALUES (?, ?, ?)`,
          chatId,
          fila.seq,
          fila.sobre
        );
        escritas += changes;
      }
    });
  });
  return escritas;
}

/** Una transacción por lote: 200 filas del delta en un solo fsync, no en 200. */
async function abrirTransaccion(abierta: SQLite.SQLiteDatabase, tarea: () => Promise<void>): Promise<void> {
  await abierta.withTransactionAsync(tarea);
}

function abrirFilas(clave: Uint8Array, filas: Fila[]): ChatMessage[] {
  const mensajes: ChatMessage[] = [];
  for (const fila of filas) {
    const mensaje = abrirCache<ChatMessage>(clave, JSON.parse(fila.sobre) as Envelope);
    // Una fila que no abre (clave distinta, sobre corrupto) se salta: el
    // server la vuelve a mandar cuando el hidratador vea el hueco.
    if (mensaje) mensajes.push(mensaje);
  }
  return mensajes;
}

/**
 * Los mensajes de un chat, ascendentes. Con `limite` devuelve los ÚLTIMOS
 * `limite` (o los últimos antes de `antesDe`): es lo que pinta la pantalla al
 * abrir, y lo que pide el scroll hacia arriba antes de molestar al server.
 *
 * `null` = no se pudo leer (sin llavero, base rota). `[]` = no hay nada.
 */
export async function leerMensajesGuardados(
  chatId: string,
  opciones: { limite?: number; antesDe?: number } = {}
): Promise<ChatMessage[] | null> {
  try {
    const [abierta, clave] = await Promise.all([listo(), claveDeCache()]);
    if (!abierta || !clave) return null;

    const condicion = opciones.antesDe ? ' AND seq < ?' : '';
    const parametros: SQLite.SQLiteBindValue[] = [chatId];
    if (opciones.antesDe) parametros.push(opciones.antesDe);

    // Descendente con LIMIT para quedarse con los últimos; se da vuelta al
    // salir porque una conversación se lee de arriba hacia abajo.
    const filas = opciones.limite
      ? (
          await abierta.getAllAsync<Fila>(
            `SELECT seq, sobre FROM mensajes WHERE chatId = ?${condicion} ORDER BY seq DESC LIMIT ?`,
            ...parametros,
            opciones.limite
          )
        ).reverse()
      : await abierta.getAllAsync<Fila>(
          `SELECT seq, sobre FROM mensajes WHERE chatId = ?${condicion} ORDER BY seq ASC`,
          ...parametros
        );

    return abrirFilas(clave, filas);
  } catch {
    return null;
  }
}

/** Filas por lectura al respaldar: cada una se descifra en el hilo de JS. */
const PAGINA_DE_LECTURA = 250;

/**
 * El chat ENTERO, ascendente, para el respaldo (FL5). Sin límite,
 * `leerMensajesGuardados` descifra todas las filas de un tirón: con 20 000
 * eran segundos de pantalla congelada. Acá va por páginas, con el cursor en el
 * `seq` de la FILA (no del mensaje abierto: una fila que no abre no corta la
 * lectura) y cediendo el hilo entre página y página.
 *
 * `null` = no se pudo leer (sin llavero, base rota).
 */
export async function leerTodosLosMensajes(
  chatId: string,
  ceder: () => Promise<void> = cederAlHilo
): Promise<ChatMessage[] | null> {
  try {
    const [abierta, clave] = await Promise.all([listo(), claveDeCache()]);
    if (!abierta || !clave) return null;
    const mensajes: ChatMessage[] = [];
    let despuesDe = 0;
    for (;;) {
      const filas = await abierta.getAllAsync<Fila>(
        'SELECT seq, sobre FROM mensajes WHERE chatId = ? AND seq > ? ORDER BY seq ASC LIMIT ?',
        chatId,
        despuesDe,
        PAGINA_DE_LECTURA
      );
      mensajes.push(...abrirFilas(clave, filas));
      if (filas.length < PAGINA_DE_LECTURA) return mensajes;
      despuesDe = filas[filas.length - 1]!.seq;
      await ceder();
    }
  } catch {
    return null;
  }
}

/** Guardar (o pisar) mensajes. Se llama con lo que LLEGA, no con la lista entera. */
export async function guardarMensajes(chatId: string, mensajes: readonly ChatMessage[]): Promise<void> {
  if (mensajes.length === 0) return;
  // La sesión se fija ANTES de esperar la clave: si se cierra en el medio, la
  // clave que llega es la vieja y estas filas no se escriben.
  const deEstaSesion = generacion;
  try {
    const [abierta, clave] = await Promise.all([listo(), claveDeCache()]);
    if (!abierta || !clave) return;
    await escribirFilas(abierta, clave, chatId, mensajes, deEstaSesion);
  } catch {
    // Deliberado: no poder guardar no puede romper el chat.
  }
}

/** Filas por transacción al importar: cifrar 200 sobres son decenas de ms. */
const LOTE_DE_IMPORTACION = 200;

/**
 * Volcar un respaldo al almacén (F12.2, revisado en FL5). Dos diferencias con
 * `guardarMensajes`:
 * - **No pisa** (`INSERT OR IGNORE`): lo que el teléfono ya tiene es más nuevo
 *   que el respaldo —el hidratador pudo traerlo, o se borró acá—, y pisarlo
 *   revivía el mensaje borrado.
 * - **En lotes que ceden el hilo**: cifrar 20 000 filas de un tirón congelaba
 *   la pantalla de restaurar.
 *
 * Devuelve las filas escritas DE VERDAD; `null` si no hay almacén.
 */
export async function importarMensajes(
  chatId: string,
  mensajes: readonly ChatMessage[],
  ceder: () => Promise<void> = cederAlHilo
): Promise<number | null> {
  const deEstaSesion = generacion;
  const [abierta, clave] = await Promise.all([listo(), claveDeCache()]);
  if (!abierta || !clave) return null;
  return porLotes(
    mensajes,
    LOTE_DE_IMPORTACION,
    (lote) => escribirFilas(abierta, clave, chatId, lote, deEstaSesion, 'IGNORE'),
    ceder
  );
}

/**
 * Poner el disco de acuerdo con una página del server: la MISMA regla que la
 * pantalla (`conciliarPagina`), aplicada a los `seq` guardados. Dentro del
 * rango de la página manda el server; lo de encima de su tope no existe; lo de
 * fuera del rango no se toca. Una sola regla en un solo lugar: si la pantalla
 * y el disco conciliaran distinto, la línea borrada volvería al reabrir.
 */
export async function conciliarPaginaGuardada(
  chatId: string,
  pagina: readonly ChatMessage[],
  ultimoDelServer?: number
): Promise<void> {
  if (pagina.length === 0) return;
  const seqs = await seqsGuardados(chatId);
  if (seqs) {
    const locales = seqs.map((seq) => ({ seq }));
    const conciliados = conciliarPagina(locales, [...pagina], ultimoDelServer);
    await eliminarMensajesGuardados(chatId, seqsQueSobran(locales, conciliados));
  }
  await guardarMensajes(chatId, pagina);
}

/** Lo que el server dejó de tener se va también del disco (`seqsQueSobran`). */
export async function eliminarMensajesGuardados(chatId: string, seqs: readonly number[]): Promise<void> {
  if (seqs.length === 0) return;
  try {
    const abierta = await listo();
    if (!abierta) return;
    const marcas = seqs.map(() => '?').join(',');
    const deEstaSesion = generacion;
    await enCola(async () => {
      if (deEstaSesion !== generacion) return;
      await abierta.runAsync(`DELETE FROM mensajes WHERE chatId = ? AND seq IN (${marcas})`, chatId, ...seqs);
    });
  } catch {
    // Igual que arriba.
  }
}

/**
 * Cambiar UN mensaje guardado (borrado o editado) sin esperar a que una página
 * del server pise la fila: si el chat no estaba abierto cuando pasó, el disco
 * seguiría mostrando lo viejo.
 */
async function reescribirGuardado(chatId: string, seq: number, cambio: (mensaje: ChatMessage) => ChatMessage): Promise<void> {
  try {
    const [abierta, clave] = await Promise.all([listo(), claveDeCache()]);
    if (!abierta || !clave) return;

    const fila = await abierta.getFirstAsync<Fila>(
      'SELECT seq, sobre FROM mensajes WHERE chatId = ? AND seq = ?',
      chatId,
      seq
    );
    if (!fila) return;
    const [mensaje] = abrirFilas(clave, [fila]);
    if (!mensaje) return;
    await escribirFilas(abierta, clave, chatId, [cambio(mensaje)]);
  } catch {
    // Igual que arriba.
  }
}

/** La lápida de un mensaje guardado. */
export function marcarBorradoGuardado(chatId: string, seq: number): Promise<void> {
  return reescribirGuardado(chatId, seq, (mensaje) => ({
    ...mensaje,
    deletedAt: new Date().toISOString(),
    body: undefined,
    media: undefined,
    envelope: undefined,
  }));
}

/** El texto nuevo de un mensaje editado, con su marca. */
export function marcarEditadoGuardado(chatId: string, seq: number, body: string, editedAt: string): Promise<void> {
  return reescribirGuardado(chatId, seq, (mensaje) => ({ ...mensaje, body, editedAt }));
}

/** El cursor de sincronización de un chat: hasta qué `seq` ya se tiene. `null` = nada guardado. */
export async function ultimoSeqGuardado(chatId: string): Promise<number | null> {
  try {
    const abierta = await listo();
    if (!abierta) return null;
    const fila = await abierta.getFirstAsync<{ ultimo: number | null }>(
      'SELECT MAX(seq) AS ultimo FROM mensajes WHERE chatId = ?',
      chatId
    );
    return fila?.ultimo ?? null;
  } catch {
    return null;
  }
}

/** Todos los `seq` guardados de un chat, para que el hidratador encuentre los huecos. */
export async function seqsGuardados(chatId: string): Promise<number[] | null> {
  try {
    const abierta = await listo();
    if (!abierta) return null;
    const filas = await abierta.getAllAsync<{ seq: number }>(
      'SELECT seq FROM mensajes WHERE chatId = ? ORDER BY seq ASC',
      chatId
    );
    return filas.map((fila) => fila.seq);
  } catch {
    return null;
  }
}

/**
 * Al cerrar sesión se borra TODO, incluida la clave.
 *
 * Sin borrar la clave, la base quedaría descifrable por quien entre después en
 * ese teléfono; sin borrar la base, quedaría el historial de alguien que ya se
 * fue.
 */
export async function olvidarMensajes(): Promise<void> {
  // Antes de cualquier await: lo que ya estaba en la cola queda descartado.
  generacion += 1;
  try {
    const abierta = abrirBase();
    await enCola(() => abierta.runAsync('DELETE FROM mensajes'));
    const viejas = (await AsyncStorage.getAllKeys()).filter((clave) => clave.startsWith(PREFIJO_CACHE_VIEJA));
    if (viejas.length > 0) await AsyncStorage.multiRemove(viejas);
    await SecureStore.deleteItemAsync(CLAVE_SECRETA, OPCIONES);
  } catch {
    // Igual que arriba.
  } finally {
    // La próxima sesión nace con clave nueva y vuelve a mirar la caché vieja.
    clavePrometida = null;
    migracion = null;
  }
}

/**
 * Lo que el respaldo (F12.1) necesita saber del almacén sin abrir una sola
 * fila: qué chats hay, hasta qué `seq` y cuántos mensajes. Con eso se decide
 * si hay algo nuevo que respaldar (`huellaDelAlmacen`).
 */
export async function resumenDelAlmacen(): Promise<{ chatId: string; ultimoSeq: number; cantidad: number }[]> {
  try {
    const abierta = await listo();
    if (!abierta) return [];
    return await abierta.getAllAsync<{ chatId: string; ultimoSeq: number; cantidad: number }>(
      'SELECT chatId, MAX(seq) AS ultimoSeq, COUNT(*) AS cantidad FROM mensajes GROUP BY chatId ORDER BY chatId'
    );
  } catch {
    return [];
  }
}
