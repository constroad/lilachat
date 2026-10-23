import { Router } from 'express';
import { Schema, model, type Types } from 'mongoose';
import { limaDayKey } from '@lilachat/shared';
import { asyncRoute } from './requireSession.js';
import { isOperator, isSuperadmin } from './operators.js';

/**
 * Every backup attempt counted by reason and day (pending 83, lila-2 23/10).
 * The 507 answers before a byte is read, so without this a zero in
 * `respaldos` could not tell «nobody created a key» from «everybody got 507».
 * One document per day and reason: a handful a day, no index needed.
 */
export const PHONE_REPORTED_REASONS = ['sin_passphrase'] as const;
const DAYS_SHOWN = 30;

type BackupAttempt = { day: string; reason: string; count: number; userIds: Types.ObjectId[] };

export const BackupAttemptModel = model<BackupAttempt>(
  'BackupAttempt',
  new Schema<BackupAttempt>({ day: { type: String, required: true }, reason: { type: String, required: true }, count: { type: Number, default: 0 }, userIds: [Schema.Types.ObjectId] }, { versionKey: false }),
  'backupattempts'
);

/**
 * Never in the way of the backup: a failed count is logged and forgotten. It is
 * awaited (one small write) so the count is there when the answer arrives;
 * fired and forgotten, a read right after could miss it.
 */
export async function recordBackupAttempt(userId: Types.ObjectId, reason: string, now = new Date()): Promise<void> {
  try {
    await BackupAttemptModel.updateOne({ day: limaDayKey(now), reason }, { $inc: { count: 1 }, $addToSet: { userIds: userId } }, { upsert: true });
  } catch (error) {
    console.error('[respaldos] no se pudo contar el intento:', error);
  }
}

/** `POST /intento` (the phone's own reasons) and `GET /intentos` (the creator and operators). */
export function mountBackupAttemptRoutes(router: Router): void {
  router.post('/intento', asyncRoute(async (req, res) => {
    const reason = String(req.body?.motivo ?? '');
    if (!(PHONE_REPORTED_REASONS as readonly string[]).includes(reason)) return res.status(400).json({ motivo: 'motivo_invalido' });
    await recordBackupAttempt(req.session!.userId, reason);
    res.status(204).end();
  }));

  router.get('/intentos', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    if (!(await isSuperadmin(userId)) && !(await isOperator(userId))) return res.status(403).json({ message: 'Solo el creador o un operador ve los intentos.' });
    const since = limaDayKey(new Date(Date.now() - DAYS_SHOWN * 86_400_000));
    const rows = await BackupAttemptModel.find({ day: { $gte: since } }).lean();
    const byReason = new Map<string, { count: number; users: Set<string> }>();
    for (const row of rows) {
      const entry = byReason.get(row.reason) ?? { count: 0, users: new Set<string>() };
      entry.count += row.count;
      row.userIds.forEach((id) => entry.users.add(String(id)));
      byReason.set(row.reason, entry);
    }
    res.json({ since, reasons: [...byReason].map(([reason, entry]) => ({ reason, count: entry.count, users: entry.users.size })) });
  }));
}
