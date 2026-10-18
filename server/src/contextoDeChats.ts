import type { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';

/**
 * De qué chat es algo y cómo se llama la gente (FL10): lo comparten encuestas
 * y eventos. El nombre definitivo lo pone la app con SU agenda; el server
 * manda el teléfono y el nombre que cada uno se puso, como respaldo.
 */
export type PersonaVisible = { phone: string; name?: string };
export type ChatVisible = { kind: 'direct' | 'group'; name?: string; phone?: string };
type InfoDeChat = { kind: 'direct' | 'group'; name?: string; otroId?: string };

/** Una consulta para todos los chats; en un 1:1, quién es el otro. */
export async function infoDeChats(chatIds: readonly Types.ObjectId[], yo: string): Promise<Map<string, InfoDeChat>> {
  const chats = await ChatModel.find({ _id: { $in: chatIds } }).select('kind name members.userId').lean();
  return new Map(
    chats.map((chat) => [
      String(chat._id),
      {
        kind: chat.kind === 'direct' ? 'direct' : 'group',
        ...(chat.name ? { name: chat.name } : {}),
        ...(chat.kind === 'direct' ? { otroId: chat.members.map((m) => String(m.userId)).find((id) => id !== yo) } : {}),
      },
    ])
  );
}

/** Una consulta para toda la gente a nombrar. */
export async function personasPorId(ids: Iterable<string>): Promise<Map<string, PersonaVisible>> {
  const usuarios = await UserModel.find({ _id: { $in: [...new Set(ids)] } }).select('phone name').lean();
  return new Map(usuarios.map((u) => [String(u._id), { phone: u.phone, ...(u.name ? { name: u.name } : {}) }]));
}

/** El chat como lo muestra la app: el grupo por su nombre; el 1:1, por el otro. */
export function chatVisible(info: InfoDeChat | undefined, personas: ReadonlyMap<string, PersonaVisible>): ChatVisible {
  const otro = info?.otroId ? personas.get(info.otroId) : undefined;
  return { kind: info?.kind ?? 'group', ...(info?.name ? { name: info.name } : {}), ...(otro ?? {}) };
}

export function soloConocidas(ids: Iterable<string>, personas: ReadonlyMap<string, PersonaVisible>): Record<string, PersonaVisible> {
  const visibles: Record<string, PersonaVisible> = {};
  for (const id of ids) {
    const persona = personas.get(id);
    if (persona) visibles[id] = persona;
  }
  return visibles;
}
