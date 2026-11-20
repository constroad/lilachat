/**
 * Report a person or a message (Google Play, José 19/11/2026). The report goes
 * to the superadmin's queue in `/admin` and, as a notice, to the admins of the
 * space where it happened. A reported message is kept as evidence even if it
 * is deleted later. Pure: reasons, validation, priority, order and texts that
 * the phone, the web and the server share.
 */

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Acoso o intimidación' },
  { id: 'sexual', label: 'Contenido sexual' },
  { id: 'child_abuse', label: 'Abuso infantil' },
  { id: 'violence', label: 'Violencia o amenazas' },
  { id: 'impersonation', label: 'Suplantación de identidad' },
  { id: 'other', label: 'Otro' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['id'];
export type ReportPriority = 'high' | 'normal';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportTarget = 'user' | 'message';
/** How the superadmin closes a report. */
export type ReportOutcome = Exclude<ReportStatus, 'open'>;

export const REPORT_NOTE_MAX = 500;
/** Anti-abuse: reports one person may send in a day. */
export const REPORTS_PER_DAY = 10;
export const REPORTS_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ADMIN_REPORTS_PAGE_SIZE = 30;

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const HIGH_PRIORITY: readonly ReportReason[] = ['child_abuse'];

export type ReportInput =
  | { target: 'message'; chatId: string; seq: number; reason: ReportReason; note: string; alsoBlock: boolean }
  | { target: 'user'; userId: string; chatId?: string; reason: ReportReason; note: string; alsoBlock: boolean };

export type ReportValidation = { ok: true; value: ReportInput } | { ok: false; reason: string };

export const isReportReason = (raw: unknown): raw is ReportReason => REPORT_REASONS.some((reason) => reason.id === raw);

export const reportReasonLabel = (reason: ReportReason): string => REPORT_REASONS.find((entry) => entry.id === reason)?.label ?? 'Otro';

export const reportPriorityOf = (reason: ReportReason): ReportPriority => (HIGH_PRIORITY.includes(reason) ? 'high' : 'normal');

const isObjectId = (raw: unknown): raw is string => typeof raw === 'string' && OBJECT_ID.test(raw);
const isPositiveInteger = (raw: unknown): raw is number => typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 1;

function noteOf(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** What a client sends to `POST /api/reports`, checked the same on both sides. */
export function validateReportInput(raw: unknown): ReportValidation {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Elige qué quieres denunciar.' };
  const body = raw as Record<string, unknown>;
  if (!isReportReason(body.reason)) return { ok: false, reason: 'Elige un motivo.' };
  const note = noteOf(body.note);
  if (note.length > REPORT_NOTE_MAX) return { ok: false, reason: `Escribe hasta ${REPORT_NOTE_MAX} caracteres.` };
  if (body.reason === 'other' && !note) return { ok: false, reason: 'Cuéntanos qué pasó.' };
  const common = { reason: body.reason, note, alsoBlock: body.alsoBlock === true };
  if (body.target === 'message') {
    if (!isObjectId(body.chatId) || !isPositiveInteger(body.seq)) return { ok: false, reason: 'No encontramos ese mensaje.' };
    return { ok: true, value: { target: 'message', chatId: body.chatId, seq: body.seq, ...common } };
  }
  if (body.target === 'user') {
    if (!isObjectId(body.userId)) return { ok: false, reason: 'No encontramos a esa persona.' };
    return { ok: true, value: { target: 'user', userId: body.userId, ...(isObjectId(body.chatId) ? { chatId: body.chatId } : {}), ...common } };
  }
  return { ok: false, reason: 'Elige qué quieres denunciar.' };
}

/** «Denunciar» on a message: someone else's, still there, and not a line the server wrote. */
export function canReportMessage(params: { mine: boolean; deleted: boolean; kind: string }): boolean {
  return !params.mine && !params.deleted && params.kind !== 'system';
}

type Queued = { status: ReportStatus; priority: ReportPriority; createdAt: string };

/** The queue: open before closed, high priority (child abuse) on top, newest first. */
export function sortReportQueue<T extends Queued>(reports: readonly T[]): T[] {
  const rank = (report: T) => (report.status === 'open' ? 0 : 2) + (report.priority === 'high' ? 0 : 1);
  return [...reports].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}

/** The push to the superadmin or a space's admins: where and why, never what was written. */
export function reportNoticeText(params: { reason: ReportReason; place: string | null; forSpaceAdmins?: boolean }): { title: string; body: string } {
  const where = params.place ? ` en ${params.place}` : '';
  const next = params.forSpaceAdmins ? 'El equipo de Lilachat la revisa.' : 'Revísala en el panel.';
  return {
    title: reportPriorityOf(params.reason) === 'high' ? 'Denuncia urgente' : 'Nueva denuncia',
    body: `${reportReasonLabel(params.reason)}${where}. ${next}`,
  };
}

/** The evidence a message report keeps, copied when it was reported. */
export type ReportEvidence = {
  seq: number;
  senderId: string;
  kind: string;
  body: string | null;
  mediaIds: string[];
  sentAt: string;
  /** The chat was secret: the server only saw an envelope, there is no text to keep. */
  encrypted: boolean;
};

export type AdminReportPerson = { id: string; name: string | null; phone: string | null };

/** One row of the superadmin's queue (`GET /api/admin/reports`). */
export type AdminReport = {
  id: string;
  target: ReportTarget;
  reason: ReportReason;
  note: string;
  priority: ReportPriority;
  status: ReportStatus;
  createdAt: string;
  reporter: AdminReportPerson;
  reported: AdminReportPerson;
  chat: { id: string; name: string | null; kind: string } | null;
  space: { id: string; name: string } | null;
  evidence: ReportEvidence | null;
  alsoBlocked: boolean;
  closedAt: string | null;
  closedNote: string;
};

export type AdminReportsPage = { reports: AdminReport[]; total: number; open: number; page: number; pageSize: number };

/** The filter of the queue from the address: `?estado=abiertas|cerradas`. */
export type AdminReportsFilter = 'open' | 'closed';
export const adminReportsFilterOf = (raw: unknown): AdminReportsFilter => (raw === 'closed' || raw === 'cerradas' ? 'closed' : 'open');

// Texts of the clients' sheet and dialog.
export const REPORT_ACTION_LABEL = 'Denunciar';
export const reportSheetTitle = (target: ReportTarget, name: string): string => (target === 'message' ? 'Denunciar este mensaje' : `Denunciar a ${name}`);
export const REPORT_SHEET_HINT = 'Nadie del chat sabrá que lo denunciaste. Si es un mensaje, guardamos una copia para revisarlo.';
export const REPORT_NOTE_PLACEHOLDER = 'Cuéntanos qué pasó (opcional)';
export const alsoBlockLabel = (name: string): string => `Bloquear también a ${name}`;
export const REPORT_SENT_TITLE = 'Recibimos tu denuncia';
export const reportSentBody = (blocked: boolean): string =>
  blocked ? 'La revisaremos. Además, bloqueaste a esta persona.' : 'La revisaremos. Gracias por ayudar a cuidar Lilachat.';
export const REPORT_SEND_LABEL = 'Enviar denuncia';

/** What the client reports: a message (the server finds its author) or a person, from a chat or not. */
export type ReportSubject = { target: 'message'; chatId: string; seq: number } | { target: 'user'; userId: string; chatId?: string };

/** «Enviar denuncia» turns on with a reason; «Otro» also needs a text; never over the limit. */
export function canSendReport(reason: ReportReason | null, note: string): boolean {
  if (!reason || note.trim().length > REPORT_NOTE_MAX) return false;
  return reason !== 'other' || note.trim().length > 0;
}
