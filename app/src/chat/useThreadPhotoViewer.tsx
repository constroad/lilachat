import { useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { offerFileActions } from './fileActions';
import { fotosDelChat } from './filasDelChat';
import { isFileMime } from './rowKinds';
import { threadPhotoMessages } from './threadReply';
import type { ChatMessage, PendingMessage } from './useChat';
import { VisorDelChat } from './VisorDelChat';

/**
 * The thread's photo viewer (José 13/11: a voucher's thread shows the photo, and a tap must open it,
 * as in the chat). The root's photo and the replies' photos, with the same viewer, download and share;
 * deleting goes through the thread's «Eliminar para todos» when the thread offers it.
 */
export function useThreadPhotoViewer(params: {
  root: ChatMessage | null;
  replies: readonly (ChatMessage | PendingMessage)[];
  me: string;
  isGroup: boolean;
  names: ReadonlyMap<string, string>;
  chatName: string;
  onDelete?: (seq: number) => void;
}): { open: (seq: number) => void; viewer: ReactNode } {
  const { root, replies, me, isGroup, names, chatName, onDelete } = params;
  const [viewingSeq, setViewingSeq] = useState<number | null>(null);
  const photos = useMemo(() => fotosDelChat(threadPhotoMessages<ChatMessage, PendingMessage>(root, replies), { yo: me, esGrupo: isGroup, nombres: names, nombreDelChat: chatName }), [root, replies, me, isGroup, names, chatName]);
  const remove = async (seq: number) => {
    if (!onDelete) return { ok: false, motivo: 'Elimínala desde el chat.' };
    onDelete(seq);
    return { ok: true };
  };
  const viewer = <VisorDelChat fotos={photos} viendoSeq={viewingSeq} onCambiar={setViewingSeq} onEliminar={remove} onError={(text) => Alert.alert('Foto', text)} />;
  // A file in a thread (José 17/11) is not a photo: it offers «Abrir» or «Descargar», as in the chat.
  const open = (seq: number) => {
    const file = [root, ...replies].find((message): message is ChatMessage => Boolean(message && 'seq' in message && message.seq === seq && !('pending' in message && message.pending)));
    if (file?.media?.url && isFileMime(file.media.mime) && !photos.some((photo) => photo.seq === seq)) {
      return offerFileActions({ url: file.media.url, cuando: new Date(file.at), mime: file.media.mime, seq, nombre: file.media.fileName }, (reason) => Alert.alert('Archivo', reason));
    }
    setViewingSeq(seq);
  };
  return { open, viewer };
}
