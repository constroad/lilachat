import { useEffect, useState } from 'react';
import { archivosDelChat, suscribirArchivos } from './colaDeArchivos';

/** Lo que este chat tiene en la cola de archivos, en vivo (FL8). */
export function useArchivosDelChat(chatId: string) {
  const [archivos, setArchivos] = useState(() => archivosDelChat(chatId));
  useEffect(() => {
    setArchivos(archivosDelChat(chatId));
    return suscribirArchivos(() => setArchivos(archivosDelChat(chatId)));
  }, [chatId]);
  return archivos;
}
