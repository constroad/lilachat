import { Router } from 'express';
import type { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { ReminderModel } from './eventModels.js';
import { chatVisible, infoDeChats, personasPorId } from './contextoDeChats.js';
import { asyncRoute, requireSession } from './requireSession.js';

/** Cuánto tiempo queda a la vista un recordatorio de una vez que ya sonó («Vencidos»). */
const VENTANA_DE_VENCIDOS_MS = 24 * 3_600_000;
const FIELDS = 'title note startsAt recurrence repeat active chatId imageUrl';
/** Los apagados que se listan para prenderlos de nuevo. */
const MAXIMO_DE_APAGADOS = 50;

type RecordatorioCrudo = { _id: Types.ObjectId; chatId?: Types.ObjectId } & Record<string, unknown>;

/** Cada recordatorio de un chat lleva su chat visible: el grupo por su nombre; el 1:1, por el otro. */
async function conSuChat(recordatorios: RecordatorioCrudo[], yo: string) {
  const chatIds = [...new Set(recordatorios.flatMap((r) => (r.chatId ? [r.chatId] : [])))];
  const chats = await infoDeChats(chatIds, yo);
  const personas = await personasPorId([...chats.values()].flatMap((chat) => (chat.otroId ? [chat.otroId] : [])));
  return recordatorios.map(({ _id, chatId, ...resto }) => ({
    ...resto,
    _id: String(_id),
    ...(chatId ? { chatId: String(chatId), chat: chatVisible(chats.get(String(chatId)), personas) } : {}),
  }));
}

/**
 * «Pendientes» (José, 20/10): lo que me suena, en una sola línea. Mis
 * recordatorios y los de TODOS mis chats (en un grupo le suenan a todos; en un
 * 1:1, a los dos; en un borrador, a mí), más «Vencidos»: los de una vez que
 * sonaron en las últimas 24 h (el cron los apaga al sonar), y los míos
 * apagados, para prenderlos. Los eventos salen de `GET /events`.
 */
export function buildPendientesRouter(): Router {
  const router = Router();
  // Sesión por ruta, no `router.use`: montado en una ruta compartida, el candado global
  // también cerraría las rutas públicas que se montan después.

  router.get('/linea', requireSession, asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const chats = await ChatModel.find({ 'members.userId': yo }).select('_id').lean();
    const meSuenan = { $or: [{ userId: yo, chatId: { $exists: false } }, { chatId: { $in: chats.map((chat) => chat._id) } }] };
    const desde = new Date(Date.now() - VENTANA_DE_VENCIDOS_MS);
    const [activos, vencidos, apagados] = await Promise.all([
      ReminderModel.find({ ...meSuenan, active: true }).select(FIELDS).sort({ startsAt: 1 }).lean<RecordatorioCrudo[]>(),
      ReminderModel.find({ ...meSuenan, active: false, recurrence: 'once', startsAt: { $gte: desde, $lte: new Date() } })
        .select(FIELDS)
        .sort({ startsAt: -1 })
        .lean<RecordatorioCrudo[]>(),
      // Los MÍOS apagados (a mano o que ya sonaron hace más de un día): se prenden de nuevo desde acá.
      ReminderModel.find({ userId: yo, chatId: { $exists: false }, active: false, $nor: [{ recurrence: 'once', startsAt: { $gte: desde, $lte: new Date() } }] })
        .select(FIELDS)
        .sort({ startsAt: -1 })
        .limit(MAXIMO_DE_APAGADOS)
        .lean<RecordatorioCrudo[]>(),
    ]);
    const [recordatorios, yaSonaron, sinSonar] = await Promise.all([conSuChat(activos, String(yo)), conSuChat(vencidos, String(yo)), conSuChat(apagados, String(yo))]);
    res.json({ recordatorios, vencidos: yaSonaron, apagados: sinSonar });
  }));

  return router;
}
