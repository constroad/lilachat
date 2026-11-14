import { useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { fotosDelChat } from './filasDelChat';
import type { ChatMessage } from './useChat';
import { VisorDelChat } from './VisorDelChat';

/**
 * The thread's photo viewer (José 13/11: a voucher's thread shows the photo, and a tap must open it,
 * as in the chat). The root's photo, with the same viewer, download and share; deleting goes through
 * the thread's «Eliminar para todos» when the thread offers it.
 */
export function useThreadPhotoViewer(params: {
  root: ChatMessage | null;
  me: string;
  isGroup: boolean;
  names: ReadonlyMap<string, string>;
  chatName: string;
  onDelete?: (seq: number) => void;
}): { open: (seq: number) => void; viewer: ReactNode } {
  const { root, me, isGroup, names, chatName, onDelete } = params;
  const [viewingSeq, setViewingSeq] = useState<number | null>(null);
  const photos = useMemo(() => (root ? fotosDelChat([root], { yo: me, esGrupo: isGroup, nombres: names, nombreDelChat: chatName }) : []), [root, me, isGroup, names, chatName]);
  const remove = async (seq: number) => {
    if (!onDelete) return { ok: false, motivo: 'Elimínala desde el chat.' };
    onDelete(seq);
    return { ok: true };
  };
  const viewer = <VisorDelChat fotos={photos} viendoSeq={viewingSeq} onCambiar={setViewingSeq} onEliminar={remove} onError={(text) => Alert.alert('Foto', text)} />;
  return { open: setViewingSeq, viewer };
}
