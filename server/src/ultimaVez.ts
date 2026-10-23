import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { isOnline } from './presence.js';
import { prefsFromUser } from './presenceModes.js';

/**
 * «últ. vez» (FL10, auditoría §46.3), como WhatsApp.
 *
 * La presencia vive en memoria (`presence.ts`); la última vez NO, porque tiene
 * que sobrevivir a un reinicio del server. Se escribe solo al quedar fuera de
 * línea (el último socket que se cierra), no en cada conexión.
 */
export async function guardarUltimaVez(userId: string, cuando: Date): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $set: { lastSeenAt: cuando } });
}

/**
 * La última vez de otro, a pedido del chat que se abre. Solo si comparten un
 * chat: a un desconocido no se le dice nada. De quien está en línea no hace
 * falta, así que no se consulta.
 */
export async function ultimaVezDeContacto(yo: string, otro: unknown): Promise<string | null> {
  if (typeof otro !== 'string' || !Types.ObjectId.isValid(otro) || otro === yo) return null;
  const comparten = await ChatModel.exists({ 'members.userId': { $all: [yo, otro] } });
  if (!comparten) return null;
  const user = await UserModel.findById(otro).select('lastSeenAt presenceMode lastSeenHidden').lean();
  const prefs = prefsFromUser(user);
  // Hidden by its owner (pending 15): not told. Invisible and online: the last seen they had,
  // so «online» does not show through the missing line.
  if (prefs.lastSeenHidden || (isOnline(otro) && prefs.mode !== 'invisible')) return null;
  return user?.lastSeenAt?.toISOString() ?? null;
}
