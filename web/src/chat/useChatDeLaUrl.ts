import { useCallback, useEffect, useState } from 'react';
import { chatDeLaRuta, rutaDelChat } from './rutaDelChat';

/**
 * El chat abierto, en la URL (`/c/<id>`): atrás y adelante del navegador
 * cambian de chat, y recargar deja el mismo abierto.
 */
export function useChatDeLaUrl(): [string | null, (chatId: string | null) => void] {
  const [chatId, setChatId] = useState<string | null>(() => chatDeLaRuta(location.pathname, location.search));

  useEffect(() => {
    const alNavegar = () => setChatId(chatDeLaRuta(location.pathname, location.search));
    window.addEventListener('popstate', alNavegar);
    return () => window.removeEventListener('popstate', alNavegar);
  }, []);

  const abrir = useCallback((siguiente: string | null) => {
    const ruta = rutaDelChat(siguiente);
    if (location.pathname + location.search !== ruta) history.pushState(null, '', ruta);
    setChatId(siguiente);
  }, []);

  return [chatId, abrir];
}
