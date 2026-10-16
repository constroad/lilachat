import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { agendaPorTelefono, suscribirAgenda } from '../contacts/agendaEnMemoria';
import { nombresPorMiembro, type MiembroConNombre } from './nombresDelGrupo';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const PLAZO_MS = 10_000;

/** Los miembros por chat, en memoria: reabrir el grupo no vuelve a pedirlos. */
const cache = new Map<string, MiembroConNombre[]>();

/**
 * Los nombres de los miembros de un grupo, para el autor de cada burbuja (FL3).
 * UN pedido por grupo y por sesión (`/api/chats/:id/detail`); en un 1:1 no pide
 * nada. Sin red queda vacío y la burbuja va sin nombre: mejor nada que uno
 * equivocado.
 */
export function useNombresDelGrupo(chatId: string, jwt: string, esGrupo: boolean): Map<string, string> {
  const agenda = useSyncExternalStore(suscribirAgenda, agendaPorTelefono, agendaPorTelefono);
  const [miembros, setMiembros] = useState<MiembroConNombre[]>(() => cache.get(chatId) ?? []);

  useEffect(() => {
    if (!esGrupo || cache.has(chatId)) return;
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/detail`, {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: AbortSignal.timeout(PLAZO_MS),
        });
        if (!respuesta.ok) return;
        const detalle = (await respuesta.json()) as { members?: MiembroConNombre[] };
        const lista = detalle.members ?? [];
        cache.set(chatId, lista);
        if (vigente) setMiembros(lista);
      } catch {
        // Sin red: las burbujas van sin nombre hasta la próxima apertura.
      }
    })();
    return () => {
      vigente = false;
    };
  }, [chatId, jwt, esGrupo]);

  return useMemo(() => nombresPorMiembro(miembros, agenda), [miembros, agenda]);
}
