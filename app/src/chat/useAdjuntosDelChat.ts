import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { encolarArchivo } from './colaDeArchivos';
import { MAXIMO_DE_FOTOS, type FotoAEnviar, type FotoElegida } from './envioDeFotos';
import type { NotaGrabada } from './useGrabadorDeVoz';
import { reportarError } from '../ui/reportarError';

/**
 * Lo que se adjunta en un chat (salió de `ChatScreen`): fotos de la galería o
 * la cámara —que pasan por la previsualización con pie (FL9b)—, archivos y
 * notas de voz. Todo termina en la cola persistida (`colaDeArchivos`).
 */
export function useAdjuntosDelChat(params: { chatId: string; onError: (texto: string) => void }) {
  /** Las fotos elegidas que se están por mandar; vacío = previsualización cerrada. */
  const [fotosElegidas, setFotosElegidas] = useState<FotoElegida[]>([]);

  /**
   * Foto, archivo o nota de voz: a la cola PERSISTIDA (FL8). La burbuja aparece
   * al instante —como WhatsApp— y sube cuando hay red, aunque se salga del chat
   * o se cierre la app; si el server la rechaza queda «No se envió» a la vista.
   */
  const upload = async (file: {
    uri: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    durationMs?: number;
    caption?: string;
    width?: number;
    height?: number;
    onda?: number[];
    /** Mandar como está, sin achicar (la foto con «HD», un documento). */
    hd?: boolean;
  }) => {
    params.onError('');
    try {
      await encolarArchivo({ chatId: params.chatId, ...file });
    } catch (error) {
      reportarError('encolarArchivo', error);
      params.onError('No se pudo preparar el archivo para enviarlo.');
    }
  };

  /**
   * La nota de voz pasa por el MISMO `upload` que una foto. Por un ref: el
   * callback queda estable y el Composer memoizado no se vuelve a dibujar.
   */
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const alNotaDeVoz = useCallback(
    (nota: NotaGrabada) =>
      uploadRef.current({
        uri: nota.uri,
        fileName: 'nota-de-voz.m4a',
        mimeType: nota.mime,
        sizeBytes: nota.bytes,
        durationMs: nota.ms,
        onda: nota.onda,
      }),
    []
  );
  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      params.onError('Permite la cámara para poder tomar fotos.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 1 });
    const asset = shot.assets?.[0];
    if (shot.canceled || !asset) return;
    // FL9b: antes de mandarla, se ve y se le pone pie.
    setFotosElegidas([asset]);
  }

  const pickFromGallery = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      // `quality: 1` y sin edición: la original llega intacta a la cola, que la
      // achica al prepararla (salvo «HD», José 19/10).
      quality: 1,
      mediaTypes: ['images', 'videos'],
      // FL9b: varias a la vez, y antes de mandarlas se ven y llevan su pie.
      allowsMultipleSelection: true,
      selectionLimit: MAXIMO_DE_FOTOS,
      orderedSelection: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    setFotosElegidas(picked.assets);
  };

  /**
   * Las elegidas, a la cola en el orden en que se eligieron (cada una con su
   * pie). Todas a la vez (auditoría 19/10: de a una, cada burbuja esperaba la
   * copia de la anterior); el orden lo conserva la cola.
   */
  const alEnviarFotos = async (fotosAEnviar: FotoAEnviar[], opciones: { hd: boolean } = { hd: false }) => {
    setFotosElegidas([]);
    await Promise.all(fotosAEnviar.map((foto) => upload({ ...foto, hd: opciones.hd })));
  };

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    // Un documento va intacto, aunque sea una imagen (como WhatsApp).
    await upload({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      sizeBytes: asset.size ?? 0,
      hd: true,
    });
  };

  // Por un ref: `pickFromCamera` se rearma en cada render y el Composer es memo.
  const camaraRef = useRef(pickFromCamera);
  camaraRef.current = pickFromCamera;
  const alCamara = useCallback(() => void camaraRef.current(), []);
  const cerrarFotos = useCallback(() => setFotosElegidas([]), []);

  return { fotosElegidas, cerrarFotos, alEnviarFotos, alCamara, alNotaDeVoz, pickFromCamera, pickFromGallery, pickFile };
}
