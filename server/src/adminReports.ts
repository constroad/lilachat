import { Types } from 'mongoose';
import { ADMIN_REPORTS_PAGE_SIZE, REPORT_NOTE_MAX, adminReportsFilterOf, type AdminReport, type AdminReportPerson, type AdminReportsPage } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { ReportModel, type Report } from './reportModel.js';
import { WorkspaceModel } from './workspaceModels.js';

/**
 * The superadmin's report queue (José 19/11): the one place of the panel that
 * shows what someone wrote, and only the copy a person chose to report.
 */
type Lookups = {
  people: Map<string, AdminReportPerson>;
  chats: Map<string, { id: string; name: string | null; kind: string }>;
  spaces: Map<string, { id: string; name: string }>;
};

const idsOf = (values: (Types.ObjectId | undefined)[]) => [...new Set(values.filter((value): value is Types.ObjectId => Boolean(value)).map(String))];
const STATUS_FILTER = { open: { status: 'open' }, closed: { status: { $in: ['resolved', 'dismissed'] } } } as const;

async function lookupsFor(reports: Report[]): Promise<Lookups> {
  const [people, chats, spaces] = await Promise.all([
    UserModel.find({ _id: { $in: idsOf(reports.flatMap((report) => [report.reporterId, report.reportedUserId])) } }).select('name phone').lean(),
    ChatModel.find({ _id: { $in: idsOf(reports.map((report) => report.chatId)) } }).select('name kind').lean(),
    WorkspaceModel.find({ _id: { $in: idsOf(reports.map((report) => report.workspaceId)) } }).select('name').lean(),
  ]);
  return {
    people: new Map(people.map((person) => [String(person._id), { id: String(person._id), name: person.name ?? null, phone: person.phone ?? null }])),
    chats: new Map(chats.map((chat) => [String(chat._id), { id: String(chat._id), name: chat.name ?? null, kind: chat.kind }])),
    spaces: new Map(spaces.map((space) => [String(space._id), { id: String(space._id), name: space.name }])),
  };
}

const personOf = (lookups: Lookups, id: Types.ObjectId): AdminReportPerson => lookups.people.get(String(id)) ?? { id: String(id), name: null, phone: null };

function adminReportOf(report: Report, lookups: Lookups): AdminReport {
  const evidence = report.evidence;
  return {
    id: String(report._id),
    target: report.target,
    reason: report.reason,
    note: report.note ?? '',
    priority: report.priority,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    reporter: personOf(lookups, report.reporterId),
    reported: personOf(lookups, report.reportedUserId),
    chat: report.chatId ? (lookups.chats.get(String(report.chatId)) ?? { id: String(report.chatId), name: null, kind: 'deleted' }) : null,
    space: report.workspaceId ? (lookups.spaces.get(String(report.workspaceId)) ?? null) : null,
    evidence: evidence ? { seq: evidence.seq, senderId: String(evidence.senderId), kind: evidence.kind, body: evidence.body ?? null, mediaIds: evidence.mediaIds ?? [], sentAt: evidence.sentAt.toISOString(), encrypted: Boolean(evidence.encrypted) } : null,
    alsoBlocked: report.alsoBlocked,
    closedAt: report.closedAt ? report.closedAt.toISOString() : null,
    closedNote: report.closedNote ?? '',
  };
}

const pageOf = (raw: unknown): number => {
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

/** `GET /api/admin/reports?estado=abiertas|cerradas&page=`: urgent first, newest first. */
export async function adminReportsPage(query: { estado?: unknown; page?: unknown }): Promise<AdminReportsPage> {
  const filter = STATUS_FILTER[adminReportsFilterOf(query.estado)];
  const page = pageOf(query.page);
  const [reports, total, open] = await Promise.all([
    ReportModel.find(filter).sort({ priority: 1, createdAt: -1 }).skip((page - 1) * ADMIN_REPORTS_PAGE_SIZE).limit(ADMIN_REPORTS_PAGE_SIZE).lean<Report[]>(),
    ReportModel.countDocuments(filter),
    ReportModel.countDocuments(STATUS_FILTER.open),
  ]);
  const lookups = await lookupsFor(reports);
  return { reports: reports.map((report) => adminReportOf(report, lookups)), total, open, page, pageSize: ADMIN_REPORTS_PAGE_SIZE };
}

type CloseOutcome = { ok: true } | { ok: false; status: 400 | 404; reason: string };

/** «Resolver» or «Descartar», with an optional note; closing twice keeps the last word. */
export async function closeReport(admin: Types.ObjectId, reportId: string, body: { outcome?: unknown; note?: unknown }): Promise<CloseOutcome> {
  if (body.outcome !== 'resolved' && body.outcome !== 'dismissed') return { ok: false, status: 400, reason: 'Elige resolver o descartar.' };
  if (!Types.ObjectId.isValid(reportId)) return { ok: false, status: 404, reason: 'Esa denuncia no existe.' };
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, REPORT_NOTE_MAX) : '';
  const updated = await ReportModel.updateOne({ _id: reportId }, { $set: { status: body.outcome, closedAt: new Date(), closedBy: admin, closedNote: note } });
  return updated.matchedCount === 1 ? { ok: true } : { ok: false, status: 404, reason: 'Esa denuncia no existe.' };
}
