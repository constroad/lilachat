import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { subirPorXhr } from './subidaXhr';

/**
 * Elegir y subir la foto del grupo.
 *
 * Vive fuera de la pantalla porque son dos cosas que no dibujan nada: pedir la
 * foto y mandarla. Dentro del componente engordaban el archivo y no se podían
 * mirar por separado.
 */
/**
 * **La foto del grupo se RECORTA antes de mandarse.**
 *
 * José, 30/08/2026: «no hay opción de hacer crop de la imagen y centrarla». Se
 * subía la foto entera y el avatar es un círculo, así que una foto apaisada
 * quedaba recortada por el medio a criterio de nadie — la cara afuera y el
 * fondo adentro. `allowsEditing` abre el recortador del sistema, y `aspect`
 * cuadrado es el que corresponde: el destino ES un círculo.
 *
 * La calidad baja a 0.9 solo acá: un avatar de 96 px no necesita el original de
 * 12 MP, y el recorte ya reencoda igual.
 */
const OPCIONES_DE_RECORTE = { quality: 0.9, allowsEditing: true, aspect: [1, 1] as [number, number] };

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
            const tomada = await ImagePicker.launchCameraAsync(OPCIONES_DE_RECORTE);
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
              ...OPCIONES_DE_RECORTE,
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
 * Va por `XMLHttpRequest` (`subirPorXhr`) y NO por `fetch`: el `fetch` de Expo
 * 57 no acepta el archivo por URI. Y no reusa el helper de mensajes porque ese
 * sube y PUBLICA un mensaje en el mismo request, que es justo lo que acá no
 * queremos — la foto del grupo no es algo que se manda al chat.
 */
export async function subirFotoDeGrupo(params: {
  baseUrl: string;
  chatId: string;
  jwt: string;
  foto: FotoElegida;
}): Promise<{ ok: true; avatarUrl?: string } | { ok: false; motivo: string }> {
  const cuerpo = new FormData();
  // El archivo se adjunta por URI: el módulo nativo lo lee del disco al armar
  // el multipart, sin pasar por memoria JS.
  cuerpo.append('file', {
    uri: params.foto.uri,
    name: params.foto.nombre,
    type: params.foto.mime,
  } as unknown as Blob);

  const respuesta = await subirPorXhr({
    url: `${params.baseUrl}/api/chats/${params.chatId}/avatar`,
    token: params.jwt,
    form: cuerpo,
    timeoutMs: 120_000,
  });
  if (respuesta.tipo === 'fallo') return { ok: false, motivo: respuesta.motivo };

  if (respuesta.status < 200 || respuesta.status >= 300) {
    const motivo = respuesta.payload.message;
    return { ok: false, motivo: typeof motivo === 'string' ? motivo : 'No se pudo cambiar la foto.' };
  }
  const url = respuesta.payload.avatarUrl;
  return { ok: true, avatarUrl: typeof url === 'string' ? url : undefined };
}
