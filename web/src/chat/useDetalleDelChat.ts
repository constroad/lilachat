import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '../api';
import { agendaNameFor, getAgendaNames, requestAgendaNames, subscribeAgendaNames } from '../contacts/phoneAgenda';
import type { MemberPill } from '@lilachat/shared';
import type { BaseLocal } from '../local/baseLocal';

/** Un miembro como lo pinta la web: el nombre ya resuelto. */
export type MiembroDelChat = { id: string; nombre: string; foto?: string; telefono?: string; rol: 'admin' | 'member'; esYo: boolean };
export type DetalleDelChat = {
  miembros: Map<string, MiembroDelChat>;
  /** Each member's pill: in a company space, the job title and the role there (design s-01). */
  pills: Map<string, MemberPill>;
  soyAdmin: boolean;
  secreto: boolean;
  /** Para el panel de info (W3b): MI silenciado, la foto y el nombre propio del chat. */
  silenciado: boolean;
  foto?: string;
  nombre?: string;
  /** La descripción del grupo o del borrador (20/10). */
  descripcion?: string;
  /** Nudges and winks in a group, switched on by an admin (21/10). */
  funAllowed?: boolean;
  /** What the members may do (pending 8); unknown counts as the defaults. */
  memberPermissions?: unknown;
  /** Birthdays on in this chat (pending 17). */
  birthdaysOn?: boolean;
  /** A channel (pending 93): who finds it, and whether it is #general. */
  channel?: { isPrivate: boolean; general: boolean };
  /** The installed apps among the members (pending 91): an admin only takes them out. */
  appIds?: ReadonlySet<string>;
};

export type Respuesta = {
  encrypted?: boolean;
  muted?: boolean;
  avatarUrl?: string;
  name?: string;
  descripcion?: string;
  funAllowed?: boolean;
  memberPermissions?: unknown;
  birthdaysOn?: boolean;
  channel?: { visibility: 'public' | 'private'; general: boolean };
  members: { id: string; name: string | null; phone: string | null; avatarUrl?: string; role?: 'admin' | 'member'; esYo?: boolean; title?: string; spaceRole?: string; app?: boolean }[];
};

/** Lo último que se vio de cada chat: cambiar de chat y volver no espera a la red. */
const vistos = new Map<string, DetalleDelChat>();

export function aDetalle(respuesta: Respuesta): DetalleDelChat {
  const miembros = new Map<string, MiembroDelChat>();
  const pills = new Map<string, MemberPill>();
  for (const uno of respuesta.members) {
    pills.set(uno.id, { role: uno.app ? 'app' : (uno.spaceRole ?? uno.role ?? 'member'), title: uno.title });
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
    pills,
    soyAdmin: respuesta.members.some((uno) => uno.esYo && uno.role === 'admin'),
    secreto: respuesta.encrypted === true,
    silenciado: respuesta.muted === true,
    foto: respuesta.avatarUrl,
    nombre: respuesta.name,
    descripcion: respuesta.descripcion,
    funAllowed: respuesta.funAllowed === true,
    memberPermissions: respuesta.memberPermissions,
    birthdaysOn: respuesta.birthdaysOn === true,
    ...(respuesta.channel ? { channel: { isPrivate: respuesta.channel.visibility === 'private', general: respuesta.channel.general } } : {}),
    appIds: new Set(respuesta.members.filter((member) => member.app).map((member) => member.id)),
  };
}

const claveGuardada = (chatId: string) => `detalle:${chatId}`;

/** Members show the name saved in the phone (20/10, option «b»), like the app. */
export function detailWithAgenda(detail: DetalleDelChat, agenda: ReadonlyMap<string, string>): DetalleDelChat {
  let changed = false;
  const members = new Map<string, MiembroDelChat>();
  for (const [id, member] of detail.miembros) {
    const saved = member.esYo ? undefined : agendaNameFor(member.telefono, agenda);
    changed ||= Boolean(saved && saved !== member.nombre);
    members.set(id, saved ? { ...member, nombre: saved } : member);
  }
  return changed ? { ...detail, miembros: members } : detail;
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
