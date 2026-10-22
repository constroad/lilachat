import type { Types } from 'mongoose';
import { normalizePeruPhone } from '@lilachat/shared';
import { UserModel } from './models.js';

/**
 * Lilachat's creator (José, 21/10: «yo, el creador, superadmin»). A fact of
 * the product, not configuration: a constant, so the panel needs nothing in
 * Torre (constroad-code-quality §3-bis).
 */
const CREATOR_PHONES: readonly string[] = ['902049935'];

/** The phones of `LILACHAT_OPERADORES`, normalized; none without the variable. */
function operatorPhones(): string[] {
  return (process.env.LILACHAT_OPERADORES ?? '')
    .split(',')
    .map((phone) => normalizePeruPhone(phone))
    .filter(Boolean);
}

async function phoneOf(userId: Types.ObjectId): Promise<string> {
  const user = await UserModel.findById(userId).select('phone').lean();
  return normalizePeruPhone(user?.phone);
}

/**
 * Who may run a manual backup: a `mongodump` of the WHOLE database, so it is
 * an operator's task (audit §46.3). Only `LILACHAT_OPERADORES`; without it,
 * nobody (the nightly cron keeps backing up).
 */
export async function isOperator(userId: Types.ObjectId): Promise<boolean> {
  const operators = operatorPhones();
  if (operators.length === 0) return false;
  const phone = await phoneOf(userId);
  return phone !== '' && operators.includes(phone);
}

/** Who sees the users panel (`adminRoutes.ts`): the creator and the operators. */
export async function isSuperadmin(userId: Types.ObjectId): Promise<boolean> {
  const phone = await phoneOf(userId);
  return phone !== '' && (CREATOR_PHONES.includes(phone) || operatorPhones().includes(phone));
}
