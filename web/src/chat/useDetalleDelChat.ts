import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '../api';
import { agendaNameFor, getAgendaNames, requestAgendaNames, subscribeAgendaNames } from '../contacts/phoneAgenda';
import { chatDetailPath, otherSpaceName, type ContactNote, type MemberPill, type QuietHours } from '@lilachat/shared';
import { useCurrentSpaceId } from '../spaces/currentSpace';
import type { BaseLocal } from '../local/baseLocal';

/** Un miembro como lo pinta la web: el nombre ya resuelto. */
export type MiembroDelChat = { id: string; nombre: string; foto?: string; telefono?: string; rol: 'admin' | 'member'; esYo: boolean; /** In a shared channel, the space of someone who is not in the one looked from. */ espacio?: string };
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
  /** Pending 9: in a 1:1, whether I blocked the other one. */
  blockedByMe?: boolean;
  /** Pending 17: my own routines in this chat. */
  routines?: { quietHours?: QuietHours; contactNote?: ContactNote };
  /** Birthdays on in this chat (pending 17). */
  birthdaysOn?: boolean;
  /** A channel (pending 93): who finds it, and whether it is #general. */
  channel?: { isPrivate: boolean; general: boolean; /** The space that owns it: in a list the chat carries the space looked from. */ ownerSpaceId?: string };
  /** The installed apps among the members (pending 91): an admin only takes them out. */
  appIds?: ReadonlySet<string>;
  /** R31/10-B6: the chat's disappearing timer in seconds; 0 = off. */
  disappearSeconds?: number;
};

export type Respuesta = {
  encrypted?: boolean;
  muted?: boolean;
  avatarUrl?: string;
  name?: string;
  descripcion?: string;
  funAllowed?: boolean;
  memberPermissions?: unknown;
  blockedByMe?: boolean;
  routines?: { quietHours?: QuietHours; contactNote?: ContactNote };
  birthdaysOn?: boolean;
  channel?: { visibility: 'public' | 'private'; general: boolean; shared?: boolean; workspaceId?: string };
  disappearSeconds?: number;
  members: { id: string; name: string | null; phone: string | null; avatarUrl?: string; role?: 'admin' | 'member'; esYo?: boolean; title?: string; spaceRole?: string; app?: boolean; /** José 11/11: in a shared channel, the space they come from. */ space?: { id: string; name: string } }[];
};

/** Lo último que se vio de cada chat: cambiar de chat y volver no espera a la red. */
const vistos = new Map<string, DetalleDelChat>();

export function aDetalle(respuesta: Respuesta): DetalleDelChat {
  const miembros = new Map<string, MiembroDelChat>();
  const pills = new Map<string, MemberPill>();
  for (const uno of respuesta.members) {
    // José 11/11: someone from another space than the channel's owner shows that space as their pill.
    pills.set(uno.id, { role: uno.app ? 'app' : (uno.spaceRole ?? uno.role ?? 'member'), title: uno.title ?? (!uno.spaceRole && uno.space ? uno.space.name : undefined) });
    miembros.set(uno.id, {
      id: uno.id,
      // «Tú» como en la app; sin nombre, el teléfono; sin nada, «Alguien».
      nombre: uno.esYo ? 'Tú' : uno.name ?? uno.phone ?? 'Alguien',
      foto: uno.avatarUrl,
      telefono: uno.phone ?? undefined,
      rol: uno.role ?? 'member',
      esYo: uno.esYo === true,
      ...(otherSpaceName(uno) ? { espacio: otherSpaceName(uno)! } : {}),
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
    blockedByMe: respuesta.blockedByMe === true,
    routines: respuesta.routines,
    birthdaysOn: respuesta.birthdaysOn === true,
    ...(respuesta.channel ? { channel: { isPrivate: respuesta.channel.visibility === 'private', general: respuesta.channel.general, ...(respuesta.channel.workspaceId ? { ownerSpaceId: respuesta.channel.workspaceId } : {}) } } : {}),
    appIds: new Set(respuesta.members.filter((member) => member.app).map((member) => member.id)),
    disappearSeconds: respuesta.disappearSeconds ?? 0,
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
  // A shared channel's roles and pills depend on the space it is looked from (local E2E 11/11).
  const viewing = useCurrentSpaceId();
  const seenKey = chatId ? `${chatId}@${viewing ?? ''}` : null;
  const [detalle, setDetalle] = useState<DetalleDelChat | null>(() => (seenKey ? vistos.get(seenKey) ?? null : null));

  useEffect(() => {
    setDetalle(seenKey ? vistos.get(seenKey) ?? null : null);
    if (!chatId || !seenKey) return;
    let vigente = true;
    // Lo guardado primero (sin red es lo único que hay); la red, después.
    void base?.meta.get(claveGuardada(chatId)).then((fila) => {
      if (vigente && fila?.valor && !vistos.has(seenKey)) setDetalle(aDetalle(fila.valor as Respuesta));
    });
    if (!jwt) return;
    void api<Respuesta>(chatDetailPath(chatId, viewing), { jwt }).then((respuesta) => {
      if (!respuesta.ok || !vigente) return;
      const nuevo = aDetalle(respuesta.data);
      vistos.set(seenKey, nuevo);
      setDetalle(nuevo);
      void base?.meta.put({ clave: claveGuardada(chatId), valor: respuesta.data });
    });
    return () => {
      vigente = false;
    };
  }, [chatId, seenKey, viewing, jwt, base, version]);

  const agenda = useSyncExternalStore(subscribeAgendaNames, getAgendaNames, getAgendaNames);
  useEffect(() => {
    if (detalle) requestAgendaNames([...detalle.miembros.values()].filter((uno) => !uno.esYo).map((uno) => uno.telefono));
  }, [detalle]);
  return useMemo(() => (detalle ? detailWithAgenda(detalle, agenda) : null), [detalle, agenda]);
}
