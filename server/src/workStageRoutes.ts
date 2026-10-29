import { Router } from 'express';
import { Types } from 'mongoose';
import { DEFAULT_WORK_STAGES, type WorkStage } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { ChecklistModel } from './checklistModel.js';
import { view } from './checklistRoutes.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeTarjeta } from './avisoDeTarjeta.js';
import { ClientChannelModel } from './bots/botClients.js';

const NO_ACCESS = 'No tienes acceso a ese canal.';

/** The channel if I am in it; `undefined` when the id is not one. */
async function channelOfMember(chatId: unknown, userId: Types.ObjectId) {
  if (typeof chatId !== 'string' || !Types.ObjectId.isValid(chatId)) return undefined;
  return ChatModel.findOne({ _id: chatId, 'members.userId': userId }).select('workspaceId encrypted').lean();
}

/**
 * A channel as a job's file (pending 21, designs e2-17/e2-18): its checklist
 * by stages. Each stage is a checklist of the channel with its `stage`
 * number and no card, so its tasks are added, assigned and ticked through the
 * routes every checklist uses. Mounted before `/checklists/:id`.
 */
export function buildWorkStageRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/checklists/stages', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const channel = await channelOfMember(req.query.chatId, userId);
    if (!channel) return res.status(403).json({ message: NO_ACCESS });
    const stages = await ChecklistModel.find({ chatId: channel._id, stage: { $exists: true } }).sort({ stage: 1 }).lean();
    res.json({ stages: stages.map((one): WorkStage & { othersCanAdd: boolean } => ({ ...view(one), stage: one.stage!, othersCanAdd: one.othersCanAdd })) });
  }));

  /** Any member starts it once, with the seven stages; each one is then edited like any checklist. */
  router.post('/checklists/stages', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const channel = await channelOfMember(req.body?.chatId, userId);
    if (!channel) return res.status(403).json({ message: NO_ACCESS });
    // José 29/10: the job's plan belongs to a client's channel only, not to every channel of the space.
    if (!channel.workspaceId || channel.encrypted || !(await ClientChannelModel.exists({ chatId: channel._id }))) return res.status(400).json({ message: 'El checklist por etapas es de los canales de cliente.' });
    if (await ChecklistModel.exists({ chatId: channel._id, stage: { $exists: true } })) return res.status(409).json({ message: 'Este canal ya tiene su checklist por etapas.' });
    const created = await ChecklistModel.insertMany(
      DEFAULT_WORK_STAGES.map((title, index) => ({ chatId: channel._id, createdBy: userId, title, items: [], othersCanMark: true, othersCanAdd: true, stage: index + 1 }))
    );
    res.status(201).json({ stages: created.length });
    void avisarCambioDeTarjeta({ chatId: channel._id, tipo: 'checklist', id: created[0]!._id });
  }));

  return router;
}
