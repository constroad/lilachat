import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Elegir y subir la foto del grupo.
 *
 * Vive fuera de la pantalla porque son dos cosas que no dibujan nada: pedir la
 * foto y mandarla. Dentro del componente engordaban el archivo y no se podían
 * mirar por separado.
 */
export type FotoElegida = { uri: string; nombre: string; mime: string };

export type ResultadoDeEleccion =
  | { tipo: 'foto'; foto: FotoElegida }
  | { tipo: 'cancelado' }
  | { tipo: 'sin-permiso' };

const desdeAsset = (asset: ImagePicker.ImagePickerAsset): FotoElegida => ({
  uri: asset.uri,
  nombre: asset.fileName ?? 'grupo.jpg',
  mime: asset.mimeType ?? 'image/jpeg',
});

/**
 * **Cámara y galería se ofrecen POR SEPARADO.** Es la lección de Portal: un
 * selector que abre la galería cuando la persona quería la cámara se lee como
 * que la cámara no funciona.
 */
export function elegirFotoDeGrupo(): Promise<ResultadoDeEleccion> {
  return new Promise((resolver) => {
    Alert.alert('Foto del grupo', 'La ven todos los que están en el grupo.', [
      {
        text: 'Cámara',
        onPress: () => {
          void (async () => {
            const permiso = await ImagePicker.requestCameraPermissionsAsync();
            if (!permiso.granted) return resolver({ tipo: 'sin-permiso' });
            const tomada = await ImagePicker.launchCameraAsync({ quality: 1 });
            const foto = tomada.assets?.[0];
            resolver(
              tomada.canceled || !foto ? { tipo: 'cancelado' } : { tipo: 'foto', foto: desdeAsset(foto) }
            );
          })();
        },
      },
      {
        text: 'Galería',
        onPress: () => {
          void (async () => {
            const elegida = await ImagePicker.launchImageLibraryAsync({
              quality: 1,
              mediaTypes: ['images'],
            });
            const foto = elegida.assets?.[0];
            resolver(
              elegida.canceled || !foto
                ? { tipo: 'cancelado' }
                : { tipo: 'foto', foto: desdeAsset(foto) }
            );
          })();
        },
      },
      // `onDismiss` no existe en Android: sin este `onPress` el diálogo cerrado
      // con ATRÁS dejaría la promesa colgada para siempre.
      { text: 'Cancelar', style: 'cancel', onPress: () => resolver({ tipo: 'cancelado' }) },
    ]);
  });
}

/**
 * Mandarla.
 *
 * Va por `FormData` y NO por el helper de mensajes: ese sube y publica un
 * mensaje en el mismo request, que es justo lo que acá no queremos — la foto
 * del grupo no es algo que se manda al chat.
 */
export async function subirFotoDeGrupo(params: {
  baseUrl: string;
  chatId: string;
  jwt: string;
  foto: FotoElegida;
}): Promise<{ ok: true; avatarUrl?: string } | { ok: false; motivo: string }> {
  const cuerpo = new FormData();
  // El `as unknown as Blob` es el contrato de FormData en RN: se le pasa el
  // descriptor del archivo, no un Blob. Sin esto no sube nada.
  cuerpo.append('file', {
    uri: params.foto.uri,
    name: params.foto.nombre,
    type: params.foto.mime,
  } as unknown as Blob);

  try {
    const respuesta = await fetch(`${params.baseUrl}/api/chats/${params.chatId}/avatar`, {
      method: 'POST',
      // Sin `Content-Type`: lo pone el runtime CON el boundary. Ponerlo a mano
      // rompe el multipart y el server no encuentra el archivo.
      headers: { Authorization: `Bearer ${params.jwt}` },
      body: cuerpo,
      signal: AbortSignal.timeout(120_000),
    });
    const datos = (await respuesta.json().catch(() => null)) as {
      avatarUrl?: string;
      message?: string;
    } | null;
    if (!respuesta.ok) {
      return { ok: false, motivo: datos?.message ?? 'No se pudo cambiar la foto.' };
    }
    return { ok: true, avatarUrl: datos?.avatarUrl };
  } catch {
    return { ok: false, motivo: 'Sin conexión. Probá de nuevo.' };
  }
}
