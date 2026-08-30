import * as FileSystem from 'expo-file-system/legacy';
// **`expo-media-library/legacy`, NO la raíz.** En SDK 57 la raíz pasó a la API
// nueva basada en clases y `saveToLibraryAsync` quedó en `/legacy`. Llamarla
// desde la raíz no revienta: avisa por consola y falla en silencio — «No pudimos
// guardarla en la galería» sin más pista.
//
// Es EXACTAMENTE el mismo pozo que `expo-contacts` (bug de los esqueletos
// eternos del 26/08/2026). Con dos módulos ya pisados, la regla para SDK 57 es:
// si una función clásica de un módulo de Expo falla sin explicación, mirar
// primero si se mudó a `/legacy`.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { nombreDeArchivo } from './archivoDescargado';

/**
 * Guardar una foto en la galería y compartirla. Los efectos, aparte del motor.
 *
 * Las dos empiezan igual —la foto vive en el servidor y hay que bajarla a un
 * archivo local— y por eso comparten `bajarACache`. Lo que cambia es el destino.
 *
 * **Nunca lanzan.** Devuelven un resultado que la pantalla puede mostrar: una
 * descarga que falla en silencio se lee como que la app ignoró el toque, y es la
 * queja que sigue a «no me deja guardar las fotos».
 */
export type Resultado = { ok: true } | { ok: false; motivo: string };

/**
 * Se baja a la CACHE y no a documentos: es una copia de trabajo. Lo que hay que
 * conservar es lo que después se copia a la galería; dejar además el original en
 * el almacenamiento de la app sería ocupar el doble para nada.
 */
async function bajarACache(params: {
  url: string;
  cuando: Date;
  mime?: string;
  seq: number;
}): Promise<{ ok: true; uri: string } | { ok: false; motivo: string }> {
  const destino = `${FileSystem.cacheDirectory}${nombreDeArchivo(params)}`;
  try {
    const { status, uri } = await FileSystem.downloadAsync(params.url, destino);
    if (status < 200 || status >= 300) {
      return { ok: false, motivo: 'No pudimos descargar la foto.' };
    }
    return { ok: true, uri };
  } catch {
    return { ok: false, motivo: 'Sin conexión para descargar la foto.' };
  }
}

/**
 * Guarda en la galería del teléfono.
 *
 * El permiso se pide con `writeOnly`: para copiar una foto NO hace falta poder
 * leer toda la galería de la persona, y pedir de más es la clase de permiso que
 * hace desinstalar una app.
 */
export async function guardarEnGaleria(params: {
  url: string;
  cuando: Date;
  mime?: string;
  seq: number;
}): Promise<Resultado> {
  const permiso = await MediaLibrary.requestPermissionsAsync(true);
  if (!permiso.granted) {
    return { ok: false, motivo: 'Necesitamos permiso para guardar en tu galería.' };
  }

  const bajada = await bajarACache(params);
  if (!bajada.ok) return bajada;

  try {
    await MediaLibrary.saveToLibraryAsync(bajada.uri);
    return { ok: true };
  } catch {
    return { ok: false, motivo: 'No pudimos guardarla en la galería.' };
  } finally {
    // La copia de trabajo se borra pase lo que pase: si no, cada foto guardada
    // deja un duplicado ocupando espacio que nadie va a limpiar nunca.
    await FileSystem.deleteAsync(bajada.uri, { idempotent: true }).catch(() => {});
  }
}

/**
 * Abre la hoja de compartir del sistema.
 *
 * **La copia NO se borra acá**, a diferencia de guardar: la hoja de compartir es
 * asíncrona y sigue viva después de que esta función termina — borrar el archivo
 * dejaría a WhatsApp o al correo intentando adjuntar algo que ya no existe. La
 * cache la limpia Android cuando necesita espacio.
 */
export async function compartirFoto(params: {
  url: string;
  cuando: Date;
  mime?: string;
  seq: number;
}): Promise<Resultado> {
  if (!(await Sharing.isAvailableAsync())) {
    return { ok: false, motivo: 'Este teléfono no puede compartir archivos.' };
  }

  const bajada = await bajarACache(params);
  if (!bajada.ok) return bajada;

  try {
    await Sharing.shareAsync(bajada.uri, { mimeType: params.mime ?? 'image/jpeg' });
    return { ok: true };
  } catch {
    return { ok: false, motivo: 'No pudimos compartir la foto.' };
  }
}

/**
 * Abrir el archivo con la app que corresponda del teléfono.
 *
 * Para un PDF —o un Excel, o un zip— esto es lo correcto y no meter un visor
 * propio: el teléfono ya tiene una app que sabe abrirlo, probablemente mejor que
 * cualquier cosa que embebamos, y traer un motor de PDF pesa más que toda esta
 * app junta.
 *
 * El archivo se baja a la cache y se comparte por `content://`: pasarle a otra
 * app un `file://` de nuestro almacenamiento privado le da una ruta que no puede
 * leer, y Android lo corta con `FileUriExposedException`.
 */
export async function abrirConOtraApp(params: {
  url: string;
  cuando: Date;
  mime?: string;
  seq: number;
}): Promise<Resultado> {
  const bajado = await bajarACache(params);
  if (!bajado.ok) return bajado;

  try {
    const contentUri = await FileSystem.getContentUriAsync(bajado.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      // FLAG_GRANT_READ_URI_PERMISSION: sin esto la otra app recibe la URI y no
      // tiene permiso para leerla.
      flags: 1,
      type: params.mime,
    });
    return { ok: true };
  } catch {
    // Ninguna app instalada sabe abrir esto. No es un fallo nuestro y se dice
    // como lo que es, con la salida al lado.
    return { ok: false, motivo: 'No hay ninguna app para abrir este archivo. Probá compartirlo.' };
  }
}
