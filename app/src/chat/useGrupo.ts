import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { agendaPorTelefono, suscribirAgenda } from '../contacts/agendaEnMemoria';
import { getSocket } from './socketClient';
import type { MiembroMencionable } from './useMenciones';
import { fotosPorMiembro, membresiaPorRespuesta, nombresPorMiembro, type MiembroConNombre } from './nombresDelGrupo';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const PLAZO_MS = 10_000;

/** Los miembros por chat, en memoria: reabrir el grupo no vuelve a pedirlos. */
const cache = new Map<string, MiembroConNombre[]>();

/**
 * What the conversation needs from its members (FL3, FL9d): each member's
 * name and photo, for the author of each bubble, and whether I am still in the
 * group. ONE request per chat and session (`/api/chats/:id/detail`), and
 * another each time the server sends `chat.changed` for that group (someone
 * was added or removed, or I was). In a 1:1 it asks once too (backlog 18: the
 * thread and its chip named the other person «Alguien» and showed «?» faces);
 * membership and mentions stay group-only.
 */
export function useGrupo(
  chatId: string,
  jwt: string,
  esGrupo: boolean
): {
  nombres: Map<string, string>;
  fotos: Map<string, string>;
  soyMiembro: boolean | null;
  mencionables: (yo: string) => MiembroMencionable[];
  /** ¿Soy admin? Para lo que solo ellos crean (el recordatorio del grupo, 19/10). */
  soyAdmin: (yo: string) => boolean;
  roles: ReadonlyMap<string, 'admin' | 'member'>;
} {
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
    if (cache.has(chatId)) return;
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/detail`, {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: AbortSignal.timeout(PLAZO_MS),
        });
        const membresia = membresiaPorRespuesta(respuesta.status);
        if (vigente && esGrupo && membresia !== null) setSoyMiembro(membresia);
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
  /** A quiénes se puede mencionar con «@» (18/10): los del grupo, sin mí. */
  const lista = useMemo(() => [...nombres].map(([id, nombre]) => ({ id, nombre, foto: fotos.get(id) })), [nombres, fotos]);
  const mencionables = useCallback((yo: string) => lista.filter((uno) => uno.id !== yo), [lista]);
  const soyAdmin = useCallback((yo: string) => miembros.some((uno) => uno.id === yo && uno.role === 'admin'), [miembros]);
  /** Each member's role, for the pill next to their name in the Slack format (design `s-01`). */
  const roleById = useMemo(() => new Map(miembros.map((member) => [member.id, member.role ?? 'member'] as const)), [miembros]);
  return { nombres, fotos, soyMiembro, mencionables, soyAdmin, roles: roleById };
}
