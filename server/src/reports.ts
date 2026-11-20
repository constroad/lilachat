import { Types } from 'mongoose';
import { REPORTS_PER_DAY, REPORTS_WINDOW_MS, reportNoticeText, reportPriorityOf, validateReportInput, type ReportInput } from '@lilachat/shared';
import { blockUser } from './blockedContacts.js';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { UserModel } from './models.js';
import { superadminUserIds } from './operators.js';
import { pushPlainNotice } from './pushService.js';
import { ReportModel, type Report } from './reportModel.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';

type Failure = { ok: false; status: 400 | 404 | 429; reason: string };
export type ReportOutcome = { ok: true; status: 200 | 201; reportId: string; duplicate: boolean; blocked: boolean } | Failure;

/** What a report points at, resolved against the base: who, where and (for a message) the copy kept. */
type Resolved = { reportedUserId: Types.ObjectId; chatId?: Types.ObjectId; workspaceId?: Types.ObjectId; seq?: number; evidence?: Report['evidence'] };

const fail = (status: Failure['status'], reason: string): Failure => ({ ok: false, status, reason });
const NO_CHAT = 'No encontramos ese chat.';

async function chatOfMember(chatId: string, me: Types.ObjectId) {
  return ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('_id workspaceId encrypted').lean();
}

function evidenceOf(message: Message, encrypted: boolean): Report['evidence'] {
  const mediaIds = [message.media?.mediaId, ...(message.files ?? []).map((file) => file.url)].filter((id): id is string => Boolean(id));
  return { seq: message.seq, senderId: message.senderId, kind: message.kind, ...(message.body ? { body: message.body } : {}), mediaIds, sentAt: message.at, encrypted };
}

async function resolveMessage(me: Types.ObjectId, input: Extract<ReportInput, { target: 'message' }>): Promise<Resolved | Failure> {
  const chat = await chatOfMember(input.chatId, me);
  if (!chat) return fail(404, NO_CHAT);
  const message = await MessageModel.findOne({ chatId: chat._id, seq: input.seq }).lean();
  if (!message || message.deletedAt) return fail(404, 'No encontramos ese mensaje.');
  if (message.senderId.equals(me)) return fail(400, 'No puedes denunciar tu propio mensaje.');
  if (message.kind === 'system') return fail(400, 'Ese aviso lo escribió Lilachat.');
  return { reportedUserId: message.senderId, chatId: chat._id, workspaceId: chat.workspaceId, seq: input.seq, evidence: evidenceOf(message, Boolean(chat.encrypted)) };
}

async function resolveUser(me: Types.ObjectId, input: Extract<ReportInput, { target: 'user' }>): Promise<Resolved | Failure> {
  const reported = new Types.ObjectId(input.userId);
  if (reported.equals(me)) return fail(400, 'No puedes denunciarte a ti.');
  if (!(await UserModel.exists({ _id: reported }))) return fail(404, 'No encontramos a esa persona.');
  if (!input.chatId) return { reportedUserId: reported };
  const chat = await chatOfMember(input.chatId, me);
  if (!chat) return fail(404, NO_CHAT);
  return { reportedUserId: reported, chatId: chat._id, workspaceId: chat.workspaceId };
}

/** The same report still open (same person, same message or same person card): sent twice, kept once. */
async function openDuplicate(me: Types.ObjectId, input: ReportInput, resolved: Resolved) {
  const filter = { reporterId: me, status: 'open' as const, target: input.target, reportedUserId: resolved.reportedUserId, ...(input.target === 'message' ? { chatId: resolved.chatId, 'evidence.seq': resolved.seq } : {}) };
  return ReportModel.findOne(filter).select('_id alsoBlocked').lean();
}

async function overDailyLimit(me: Types.ObjectId, now: number): Promise<boolean> {
  return (await ReportModel.countDocuments({ reporterId: me, createdAt: { $gte: new Date(now - REPORTS_WINDOW_MS) } })) >= REPORTS_PER_DAY;
}

/** The space's owners and admins, minus whoever reported and whoever was reported. */
async function spaceAdminIds(workspaceId: Types.ObjectId, exclude: readonly string[]): Promise<string[]> {
  const admins = await WorkspaceMemberModel.find({ workspaceId, status: 'active', role: { $in: ['owner', 'admin'] }, userId: { $exists: true } }).select('userId').lean();
  return admins.map((admin) => String(admin.userId)).filter((id) => !exclude.includes(id));
}

/** The superadmin hears of every report; the space's admins, of the ones in their space (José 19/11). */
async function notifyModerators(report: Pick<Report, 'reason' | 'reporterId' | 'reportedUserId' | 'workspaceId'>): Promise<void> {
  const exclude = [String(report.reporterId), String(report.reportedUserId)];
  const space = report.workspaceId ? await WorkspaceModel.findById(report.workspaceId).select('name').lean() : null;
  const superadmins = (await superadminUserIds()).filter((id) => !exclude.includes(id));
  const admins = report.workspaceId ? (await spaceAdminIds(report.workspaceId, exclude)).filter((id) => !superadmins.includes(id)) : [];
  await Promise.all([
    pushPlainNotice(superadmins, reportNoticeText({ reason: report.reason, place: space?.name ?? null })),
    pushPlainNotice(admins, reportNoticeText({ reason: report.reason, place: space?.name ?? null, forSpaceAdmins: true })),
  ]);
}

/** `POST /api/reports`: validate, resolve, keep the evidence, block if asked, and notify. */
export async function createReport(me: Types.ObjectId, raw: unknown, now: number = Date.now()): Promise<ReportOutcome> {
  const validation = validateReportInput(raw);
  if (!validation.ok) return fail(400, validation.reason);
  const input = validation.value;
  const resolved = input.target === 'message' ? await resolveMessage(me, input) : await resolveUser(me, input);
  if ('ok' in resolved) return resolved;
  const duplicate = await openDuplicate(me, input, resolved);
  if (duplicate) return { ok: true, status: 200, reportId: String(duplicate._id), duplicate: true, blocked: duplicate.alsoBlocked };
  if (await overDailyLimit(me, now)) return fail(429, 'Enviaste muchas denuncias hoy. Prueba mañana.');
  const blocked = input.alsoBlock ? (await blockUser(me, String(resolved.reportedUserId))).ok : false;
  const report = await ReportModel.create({
    reporterId: me,
    target: input.target,
    reportedUserId: resolved.reportedUserId,
    chatId: resolved.chatId,
    workspaceId: resolved.workspaceId,
    reason: input.reason,
    note: input.note,
    priority: reportPriorityOf(input.reason),
    alsoBlocked: blocked,
    evidence: resolved.evidence,
  });
  await notifyModerators(report);
  return { ok: true, status: 201, reportId: String(report._id), duplicate: false, blocked };
}
