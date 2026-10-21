import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '../api';
import { agendaNameFor, getAgendaNames, requestAgendaNames, subscribeAgendaNames } from '../contacts/phoneAgenda';
import type { BaseLocal } from '../local/baseLocal';

/** Un miembro como lo pinta la web: el nombre ya resuelto. */
export type MiembroDelChat = { id: string; nombre: string; foto?: string; telefono?: string; rol: 'admin' | 'member'; esYo: boolean };
export type DetalleDelChat = {
  miembros: Map<string, MiembroDelChat>;
  soyAdmin: boolean;
  secreto: boolean;
  /** Para el panel de info (W3b): MI silenciado, la foto y el nombre propio del chat. */
  silenciado: boolean;
  foto?: string;
  nombre?: string;
  /** La descripción del grupo o del borrador (20/10). */
  descripcion?: string;
};

export type Respuesta = {
  encrypted?: boolean;
  muted?: boolean;
  avatarUrl?: string;
  name?: string;
  descripcion?: string;
  members: { id: string; name: string | null; phone: string | null; avatarUrl?: string; role?: 'admin' | 'member'; esYo?: boolean }[];
};

/** Lo último que se vio de cada chat: cambiar de chat y volver no espera a la red. */
const vistos = new Map<string, DetalleDelChat>();

export function aDetalle(respuesta: Respuesta): DetalleDelChat {
  const miembros = new Map<string, MiembroDelChat>();
  for (const uno of respuesta.members) {
    miembros.set(uno.id, {
      id: uno.id,
      // «Tú» como en la app; sin nombre, el teléfono; sin nada, «Alguien».
      nombre: uno.esYo ? 'Tú' : uno.name ?? uno.phone ?? 'Alguien',
      foto: uno.avatarUrl,
      telefono: uno.phone ?? undefined,
      rol: uno.role ?? 'member',
      esYo: uno.esYo === true,
    });
  }
  return {
    miembros,
    soyAdmin: respuesta.members.some((uno) => uno.esYo && uno.role === 'admin'),
    secreto: respuesta.encrypted === true,
    silenciado: respuesta.muted === true,
    foto: respuesta.avatarUrl,
    nombre: respuesta.name,
    descripcion: respuesta.descripcion,
  };
}

const claveGuardada = (chatId: string) => `detalle:${chatId}`;

/** Members show the name saved in the phone (20/10, option «b»), like the app. */
export function detailWithAgenda(detalle: DetalleDelChat, agenda: ReadonlyMap<string, string>): DetalleDelChat {
  let changed = false;
  const miembros = new Map<string, MiembroDelChat>();
  for (const [id, miembro] of detalle.miembros) {
    const saved = miembro.esYo ? undefined : agendaNameFor(miembro.telefono, agenda);
    changed ||= Boolean(saved && saved !== miembro.nombre);
    miembros.set(id, saved ? { ...miembro, nombre: saved } : miembro);
  }
  return changed ? { ...detalle, miembros } : detalle;
}

/**
 * Los miembros del chat abierto (W2): de acá salen el nombre y el color del
 * autor en los grupos, las menciones y la «Info». Se guardan en la base local
 * (W4): sin red, los autores siguen con su nombre y no «Alguien».
 */
export function useDetalleDelChat(chatId: string | null, jwt: string, base: BaseLocal | null, version: number | string = 0): DetalleDelChat | null {
  const [detalle, setDetalle] = useState<DetalleDelChat | null>(() => (chatId ? vistos.get(chatId) ?? null : null));

  useEffect(() => {
    setDetalle(chatId ? vistos.get(chatId) ?? null : null);
    if (!chatId) return;
    let vigente = true;
    // Lo guardado primero (sin red es lo único que hay); la red, después.
    void base?.meta.get(claveGuardada(chatId)).then((fila) => {
      if (vigente && fila?.valor && !vistos.has(chatId)) setDetalle(aDetalle(fila.valor as Respuesta));
    });
    if (!jwt) return;
    void api<Respuesta>(`/chats/${chatId}/detail`, { jwt }).then((respuesta) => {
      if (!respuesta.ok || !vigente) return;
      const nuevo = aDetalle(respuesta.data);
      vistos.set(chatId, nuevo);
      setDetalle(nuevo);
      void base?.meta.put({ clave: claveGuardada(chatId), valor: respuesta.data });
    });
    return () => {
      vigente = false;
    };
  }, [chatId, jwt, base, version]);

  const agenda = useSyncExternalStore(subscribeAgendaNames, getAgendaNames, getAgendaNames);
  useEffect(() => {
    if (detalle) requestAgendaNames([...detalle.miembros.values()].filter((uno) => !uno.esYo).map((uno) => uno.telefono));
  }, [detalle]);
  return useMemo(() => (detalle ? detailWithAgenda(detalle, agenda) : null), [detalle, agenda]);
}
