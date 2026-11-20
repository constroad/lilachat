import { UserModel } from './models.js';

/**
 * The accounts whose deletion was asked (José 19/11): closed at once, without
 * waiting for their 24 h JWT to expire. In the process's memory, like presence
 * and the QR links (one process on the mini); loaded from the base at boot.
 * `requireSession` and the socket read it on every call, so it must stay a Set.
 */
const closed = new Set<string>();

export const isAccountClosed = (userId: string): boolean => closed.has(userId);
export const markAccountClosed = (userId: string): void => void closed.add(userId);
export const markAccountOpen = (userId: string): void => void closed.delete(userId);

/** At boot, after the base: every account waiting for its purge, or already erased. */
export async function loadClosedAccounts(): Promise<number> {
  const accounts = await UserModel.find({ deletionRequestedAt: { $exists: true } }).select('_id').lean();
  for (const account of accounts) closed.add(String(account._id));
  return accounts.length;
}

/** Tests only: each file starts with no closed account. */
export const forgetClosedAccounts = (): void => closed.clear();
