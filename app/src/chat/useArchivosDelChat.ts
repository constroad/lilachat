import { useEffect, useState } from 'react';
import { archivosDelChat, suscribirArchivos } from './colaDeArchivos';
import { mediaInFlightOf, subscribeMediaInFlight } from './gifs/gifsInFlight';

/** What this chat has in the file queue, plus the GIFs (22/10) and stickers (02/11) on their way, live (FL8). */
const queuedOf = (chatId: string) => [...archivosDelChat(chatId), ...mediaInFlightOf(chatId).map((archivo) => ({ archivo, progreso: undefined as number | undefined }))];

export function useArchivosDelChat(chatId: string) {
  const [archivos, setArchivos] = useState(() => queuedOf(chatId));
  useEffect(() => {
    setArchivos(queuedOf(chatId));
    const refresh = () => setArchivos(queuedOf(chatId));
    const stopFiles = suscribirArchivos(refresh);
    const stopGifs = subscribeMediaInFlight(refresh);
    return () => {
      stopFiles();
      stopGifs();
    };
  }, [chatId]);
  return archivos;
}
