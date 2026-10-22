import { useEffect, useState } from 'react';
import { archivosDelChat, suscribirArchivos } from './colaDeArchivos';
import { gifsInFlightOf, subscribeGifsInFlight } from './gifs/gifsInFlight';

/** What this chat has in the file queue, plus the GIFs on their way (22/10), live (FL8). */
const queuedOf = (chatId: string) => [...archivosDelChat(chatId), ...gifsInFlightOf(chatId).map((archivo) => ({ archivo, progreso: undefined as number | undefined }))];

export function useArchivosDelChat(chatId: string) {
  const [archivos, setArchivos] = useState(() => queuedOf(chatId));
  useEffect(() => {
    setArchivos(queuedOf(chatId));
    const refresh = () => setArchivos(queuedOf(chatId));
    const stopFiles = suscribirArchivos(refresh);
    const stopGifs = subscribeGifsInFlight(refresh);
    return () => {
      stopFiles();
      stopGifs();
    };
  }, [chatId]);
  return archivos;
}
