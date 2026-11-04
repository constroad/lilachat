import { randomUUID } from 'node:crypto';
import { internalPhoneKey } from '@lilachat/shared';
import { UserModel, type User } from './models.js';

const DUPLICATE_KEY = 11000;

const verifiedOwnerOf = (email: string) => UserModel.findOne({ email, emailVerifiedAt: { $exists: true } }).lean<User | null>();

/**
 * The account of an email whose code was just proved (spec INGRESO-POR-ESPACIO
 * §4): the one that verified it, or a new one with an internal key in `phone`.
 * An account that only held it unverified lets it go, as in `profileRoutes.ts`.
 */
export async function accountOfEmail(email: string): Promise<User> {
  const owner = await verifiedOwnerOf(email);
  if (owner) return owner;
  await UserModel.updateMany({ email, emailVerifiedAt: { $exists: false } }, { $unset: { email: 1 } });
  try {
    return (await UserModel.create({ phone: internalPhoneKey(randomUUID()), email, emailVerifiedAt: new Date() })).toObject();
  } catch (error) {
    // Two devices proved it at once: the unique index picks one, and both enter it.
    const winner = (error as { code?: number }).code === DUPLICATE_KEY ? await verifiedOwnerOf(email) : null;
    if (winner) return winner;
    throw error;
  }
}
