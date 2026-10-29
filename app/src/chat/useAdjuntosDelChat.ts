import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { encolarArchivo } from './colaDeArchivos';
import { documentsToSend } from './attachSelection';
import { MAXIMO_DE_FOTOS, type FotoAEnviar, type FotoElegida } from './envioDeFotos';
import type { NotaGrabada } from './useGrabadorDeVoz';
import { reportarError } from '../ui/reportarError';
import { newAlbumId } from '@lilachat/shared';

/**
 * Lo que se adjunta en un chat (salió de `ChatScreen`): fotos de la galería o
 * la cámara —que pasan por la previsualización con pie (FL9b)—, archivos y
 * notas de voz. Todo termina en la cola persistida (`colaDeArchivos`).
 */
export function useAdjuntosDelChat(params: { chatId: string; onError: (texto: string) => void }) {
  /** Las fotos elegidas que se están por mandar; vacío = previsualización cerrada. */
  const [fotosElegidas, setFotosElegidas] = useState<FotoElegida[]>([]);
  const [camaraAbierta, setCamaraAbierta] = useState(false);

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
    albumId?: string;
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
    // 20/10: la cámara PROPIA (`CamaraDelChat`), lista al abrir; la del sistema tardaba segundos.
    setCamaraAbierta(true);
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
    // Two or more photos or videos together go as one album (pending 12).
    const albumId = fotosAEnviar.length >= 2 ? newAlbumId() : undefined;
    await Promise.all(fotosAEnviar.map((foto) => upload({ ...foto, hd: opciones.hd, albumId })));
  };

  const pickFile = async () => {
    // Several at once (pending 112); each goes untouched, in the order chosen (the queue keeps it).
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
    if (picked.canceled) return;
    await Promise.all(documentsToSend(picked.assets).map((file) => upload(file)));
  };

  // Por un ref: `pickFromCamera` se rearma en cada render y el Composer es memo.
  const camaraRef = useRef(pickFromCamera);
  camaraRef.current = pickFromCamera;
  const alCamara = useCallback(() => void camaraRef.current(), []);
  const cerrarFotos = useCallback(() => setFotosElegidas([]), []);

  // La cámara propia manda sola (su «Enviar» va adentro): acá solo se abre, se cierra o salta a la galería.
  /** From the clip's gallery (20/10): straight to the preview with captions and HD. */
  const pickMedia = (photos: FotoElegida[]) => {
    if (photos.length) setFotosElegidas(photos);
  };
  const camara = { abierta: camaraAbierta, enviar: alEnviarFotos, cerrar: () => setCamaraAbierta(false), aLaGaleria: () => { setCamaraAbierta(false); void pickFromGallery(); } };
  return { fotosElegidas, cerrarFotos, alEnviarFotos, alCamara, alNotaDeVoz, pickFromCamera, pickFromGallery, pickMedia, pickFile, camara };
}
