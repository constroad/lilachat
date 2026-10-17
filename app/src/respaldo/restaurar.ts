import * as FileSystem from 'expo-file-system/legacy';
import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { abrirRespaldoAsync } from '@lilachat/shared';
import { BASE_URL, ultimoRespaldo, type EstadoDeRespaldos } from '../api/client';
import { importarMensajes, resumenDelAlmacen } from '../chat/mensajesGuardados';
import type { ChatMessage } from '../chat/useChat';
import { huellaDeArchivo } from './archivosDeRespaldo';
import { guardarEstadoDeRespaldo } from './estadoDeRespaldo';
import { guardarPassphrase } from './passphraseDeRespaldo';
import { huellaDelAlmacen } from './planDeRespaldo';
import { decidirOferta, verificarDescarga } from './planDeRestauracion';

/**
 * Restaurar en un teléfono nuevo (F12.2): bajar el último respaldo de la
 * mini, comprobar que es lo que el server dijo, abrirlo con la passphrase, y
 * volcarlo al almacén. Lo que Lilafotos no tiene, porque para fotos el server
 * es la verdad; acá la verdad es el teléfono, y un teléfono nuevo la pierde
 * si nadie la trae de vuelta.
 */
export type RespaldoEnLaMini = NonNullable<EstadoDeRespaldos['ultimo']>;

export type PasoDeRestauracion = 'bajando' | 'verificando' | 'abriendo' | 'importando';

export type ResultadoDeRestauracion =
  /** `mensajes` = filas escritas de verdad (lo que el teléfono ya tenía no se pisa). */
  | { ok: true; chats: number; mensajes: number }
  | { ok: false; motivo: 'descarga' | 'huella' | 'passphrase' | 'importacion' };

const CLAVE_OFRECIDO = 'lilachat.respaldo.ofrecido';

/** El respaldo a ofrecer al arrancar, o `null`. Solo pregunta al server si vale la pena (almacén vacío, no ofrecido). */
export async function respaldoAOfrecer(jwt: string): Promise<RespaldoEnLaMini | null> {
  const [resumen, ofrecido] = await Promise.all([resumenDelAlmacen(), AsyncStorage.getItem(CLAVE_OFRECIDO).catch(() => null)]);
  const previa = decidirOferta({ hayRespaldo: true, almacenVacio: resumen.length === 0, yaOfrecido: ofrecido === '1' });
  if (previa === 'nada') return null;

  const respuesta = await ultimoRespaldo(jwt);
  const respaldo = respuesta.ok ? respuesta.data.respaldo : null;
  return decidirOferta({ hayRespaldo: Boolean(respaldo), almacenVacio: true, yaOfrecido: false }) === 'ofrecer' ? respaldo : null;
}

/** Se ofrece una vez: quien dijo «ahora no» no lo ve en cada arranque. */
export async function marcarOfrecido(): Promise<void> {
  await AsyncStorage.setItem(CLAVE_OFRECIDO, '1').catch(() => undefined);
}

export async function restaurarDesdeLaMini(params: {
  jwt: string;
  respaldo: RespaldoEnLaMini;
  passphrase: string;
  onPaso?: (paso: PasoDeRestauracion) => void;
}): Promise<ResultadoDeRestauracion> {
  const carpeta = new Directory(Paths.cache, 'restauracion');
  if (!carpeta.exists) carpeta.create({ intermediates: true });
  const destino = new File(carpeta, params.respaldo.nombre);

  try {
    params.onPaso?.('bajando');
    const bajada = await FileSystem.downloadAsync(
      `${BASE_URL}/api/respaldos/${encodeURIComponent(params.respaldo.nombre)}`,
      destino.uri,
      { headers: { Authorization: `Bearer ${params.jwt}` } }
    );
    if (bajada.status !== 200) return { ok: false, motivo: 'descarga' };

    params.onPaso?.('verificando');
    const { huella } = await huellaDeArchivo(destino.uri);
    if (!verificarDescarga({ esperada: params.respaldo.huella, calculada: huella })) return { ok: false, motivo: 'huella' };

    params.onPaso?.('abriendo');
    // v2 por trozos o v1 de un sobre; los dos sin congelar la pantalla (FL5).
    const contenido = await abrirRespaldoAsync(params.passphrase, JSON.parse(await destino.text()));
    if (!contenido) return { ok: false, motivo: 'passphrase' };

    params.onPaso?.('importando');
    let mensajes = 0;
    for (const chat of contenido.chats) {
      const escritas = await importarMensajes(chat.chatId, chat.mensajes as ChatMessage[]);
      if (escritas === null) return { ok: false, motivo: 'importacion' };
      mensajes += escritas;
    }

    // Lo restaurado ya está en la mini: el próximo respaldo solo sale si algo cambia.
    await guardarPassphrase(params.passphrase);
    await guardarEstadoDeRespaldo({
      huellaRespaldada: huellaDelAlmacen(await resumenDelAlmacen()),
      huellaPendiente: null,
      ultimoRespaldoEn: new Date(params.respaldo.creadoEn).getTime(),
      bytesDelUltimo: params.respaldo.bytes,
      fallo: null,
    });
    return { ok: true, chats: contenido.chats.length, mensajes };
  } catch {
    return { ok: false, motivo: 'importacion' };
  } finally {
    try {
      if (destino.exists) destino.delete();
    } catch {
      // Un temporal que no se pudo borrar lo limpia el sistema: es la caché.
    }
  }
}
