import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { agendaPorTelefono, suscribirAgenda } from '../contacts/agendaEnMemoria';
import { getSocket } from './socketClient';
import { fotosPorMiembro, membresiaPorRespuesta, nombresPorMiembro, type MiembroConNombre } from './nombresDelGrupo';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const PLAZO_MS = 10_000;

/** Los miembros por chat, en memoria: reabrir el grupo no vuelve a pedirlos. */
const cache = new Map<string, MiembroConNombre[]>();

/**
 * Lo que la conversación necesita saber de su grupo (FL3, FL9d): los nombres
 * de los miembros —para el autor de cada burbuja— y si sigo siendo uno de
 * ellos. UN pedido por grupo y por sesión (`/api/chats/:id/detail`), y otro
 * cada vez que el server avisa `chat.changed` de ese chat (sumaron o sacaron a
 * alguien, o me sacaron a mí). En un 1:1 no pide nada.
 */
export function useGrupo(
  chatId: string,
  jwt: string,
  esGrupo: boolean
): { nombres: Map<string, string>; fotos: Map<string, string>; soyMiembro: boolean | null } {
  const agenda = useSyncExternalStore(suscribirAgenda, agendaPorTelefono, agendaPorTelefono);
  const [miembros, setMiembros] = useState<MiembroConNombre[]>(() => cache.get(chatId) ?? []);
  const [soyMiembro, setSoyMiembro] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);

  // El server avisa cambios del chat: se vuelve a preguntar.
  useEffect(() => {
    if (!esGrupo) return;
    const socket = getSocket();
    const alCambiar = (frame: { chatId?: string }) => {
      if (frame?.chatId !== chatId) return;
      cache.delete(chatId);
      setVersion((actual) => actual + 1);
    };
    socket?.on('chat.changed', alCambiar);
    return () => {
      socket?.off('chat.changed', alCambiar);
    };
  }, [chatId, esGrupo]);

  useEffect(() => {
    if (!esGrupo || cache.has(chatId)) return;
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/detail`, {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: AbortSignal.timeout(PLAZO_MS),
        });
        const membresia = membresiaPorRespuesta(respuesta.status);
        if (vigente && membresia !== null) setSoyMiembro(membresia);
        if (!respuesta.ok) return;
        const detalle = (await respuesta.json()) as { members?: MiembroConNombre[] };
        const lista = detalle.members ?? [];
        cache.set(chatId, lista);
        if (vigente) setMiembros(lista);
      } catch {
        // Sin red: las burbujas van sin nombre y la membresía queda como estaba.
      }
    })();
    return () => {
      vigente = false;
    };
  }, [chatId, jwt, esGrupo, version]);

  const nombres = useMemo(() => nombresPorMiembro(miembros, agenda), [miembros, agenda]);
  const fotos = useMemo(() => fotosPorMiembro(miembros), [miembros]);
  return { nombres, fotos, soyMiembro };
}
