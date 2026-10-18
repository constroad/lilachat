import type { Types } from 'mongoose';
import { summarizeRsvp } from '@lilachat/shared';
import { chatVisible, infoDeChats, personasPorId, soloConocidas, type ChatVisible, type PersonaVisible } from './contextoDeChats.js';
import type { ChatEvent } from './eventModels.js';

/** El evento como lo ve UNA persona (FL10, auditoría §46.3). */
export type VistaDeEvento = Omit<ChatEvent, '_id' | 'attendees'> & {
  id: string;
  mio: boolean;
  rsvpSummary: ReturnType<typeof summarizeRsvp>;
  myRsvp: string | null;
  attendees: { userId: string; rsvp?: string; invitedBy?: string }[];
  /** De qué chat. No viene si no soy del chat: me invitaron de afuera. */
  chat?: ChatVisible;
  /** Quien lo creó y los invitados, para nombrarlos con la agenda. */
  personas: Record<string, PersonaVisible>;
  /** Quien lo creó, siempre; los demás, si «Pueden invitar a otros» está encendido. */
  puedoInvitar: boolean;
};

export async function vistasDeEventos(
  eventos: ChatEvent[],
  yo: Types.ObjectId,
  misChats: ReadonlySet<string>
): Promise<VistaDeEvento[]> {
  const mio = String(yo);
  const chats = await infoDeChats(eventos.map((evento) => evento.chatId), mio);
  const otros = [...chats.values()].flatMap((chat) => (chat.otroId ? [chat.otroId] : []));
  const nombrar = (evento: ChatEvent) => [String(evento.createdBy), ...evento.attendees.map((a) => String(a.userId))];
  const personas = await personasPorId([...eventos.flatMap(nombrar), ...otros]);

  return eventos.map(({ _id, attendees, ...evento }) => {
    const esMio = String(evento.createdBy) === mio;
    const soyInvitado = attendees.some((a) => String(a.userId) === mio);
    const delChat = misChats.has(String(evento.chatId));
    return {
      ...evento,
      id: String(_id),
      mio: esMio,
      rsvpSummary: summarizeRsvp(attendees),
      myRsvp: attendees.find((a) => String(a.userId) === mio)?.rsvp ?? null,
      attendees: attendees.map((a) => ({
        userId: String(a.userId),
        ...(a.rsvp ? { rsvp: a.rsvp } : {}),
        ...(a.invitedBy ? { invitedBy: String(a.invitedBy) } : {}),
      })),
      ...(delChat ? { chat: chatVisible(chats.get(String(evento.chatId)), personas) } : {}),
      personas: soloConocidas(nombrar({ _id, attendees, ...evento }), personas),
      puedoInvitar: esMio || (evento.guestsCanInvite && (soyInvitado || delChat)),
    };
  });
}
