import type { MessageTarget } from '@lilachat/shared';
import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { encolarArchivo } from './colaDeArchivos';
import { documentsToSend } from './attachSelection';
import { MAXIMO_DE_FOTOS, type FotoAEnviar, type FotoElegida } from './envioDeFotos';
import type { NotaGrabada } from './useGrabadorDeVoz';
import { reportarError } from '../ui/reportarError';
import { newAlbumId } from '@lilachat/shared';

type AttachmentParams = {
  chatId: string;
  onError: (message: string) => void;
  /** The message being answered when the file goes (José 10/11), read at that moment. */
  target?: () => MessageTarget;
  /** The answer was used: the quote strip closes, like after a text. */
  onTargetSpent?: () => void;
};
type QueuedFile = Omit<Parameters<typeof encolarArchivo>[0], 'chatId' | 'target'>;

/**
 * Photo, file or voice note to the PERSISTED queue (FL8): the bubble shows at
 * once, like WhatsApp, and goes up when there is signal, even if the chat or
 * the app closes; a refusal stays in sight as «No se envió».
 */
async function uploadToQueue(params: AttachmentParams, file: QueuedFile): Promise<void> {
  params.onError('');
  const target = params.target?.() ?? {};
  try {
    await encolarArchivo({ chatId: params.chatId, ...file, ...(target.replyToSeq || target.hiloDe ? { target } : {}) });
    if (target.replyToSeq) params.onTargetSpent?.();
  } catch (error) {
    reportarError('encolarArchivo', error);
    params.onError('No se pudo preparar el archivo para enviarlo.');
  }
}

/**
 * The gallery untouched (`quality: 1`, no editing): the queue shrinks each one
 * when preparing it, except «HD» (José 19/10). Several at once, previewed with
 * their captions before going (FL9b).
 */
async function pickGalleryMedia(): Promise<FotoElegida[]> {
  const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: MAXIMO_DE_FOTOS, orderedSelection: true });
  return picked.canceled ? [] : (picked.assets ?? []);
}

/** Several documents at once (pending 112); each goes untouched, in the order chosen (the queue keeps it). */
async function pickDocuments(): Promise<QueuedFile[]> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
  return picked.canceled ? [] : documentsToSend(picked.assets);
}

/**
 * What is attached in a chat (it came out of `ChatScreen`): photos from the
 * gallery or the camera, which go through the preview with captions (FL9b),
 * files and voice notes. Everything ends in the persisted queue.
 */
export function useChatAttachments(params: AttachmentParams) {
  /** Las fotos elegidas que se están por mandar; vacío = previsualización cerrada. */
  const [fotosElegidas, setFotosElegidas] = useState<FotoElegida[]>([]);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const upload = (file: QueuedFile) => uploadToQueue(params, file);

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
    const media = await pickGalleryMedia();
    if (media.length) setFotosElegidas(media);
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
    await Promise.all((await pickDocuments()).map((file) => upload(file)));
  };

  // Por un ref: `pickFromCamera` se rearma en cada render y el Composer es memo.
  const camaraRef = useRef(pickFromCamera);
  camaraRef.current = pickFromCamera;
  const alCamara = useCallback(() => void camaraRef.current(), []);
  const cerrarFotos = useCallback(() => setFotosElegidas([]), []);

  // La cámara propia manda sola (su «Enviar» va adentro): acá solo se abre, se cierra o salta a la galería.
  /** From the clip's gallery (20/10): straight to the preview with captions and HD. */
  const pickMedia = useCallback((photos: FotoElegida[]) => {
    if (photos.length) setFotosElegidas(photos);
  }, []);
  /** A pasted image (21/10), stable for the memoized bar. */
  const pastePhoto = useCallback((photo: FotoElegida) => pickMedia([photo]), [pickMedia]);
  const camara = { abierta: camaraAbierta, enviar: alEnviarFotos, cerrar: () => setCamaraAbierta(false), aLaGaleria: () => { setCamaraAbierta(false); void pickFromGallery(); } };
  return { fotosElegidas, cerrarFotos, alEnviarFotos, alCamara, alNotaDeVoz, pickFromCamera, pickFromGallery, pickMedia, pastePhoto, pickFile, camara };
}
