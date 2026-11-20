import { ACCOUNT_DELETION_CONFIRM_WORD } from '@lilachat/shared';
import { api } from '../api';

export type DeletionOutcome = { ok: true; deadline: Date } | { ok: false; message: string };

/** `POST /api/me/account-deletion` (José 19/11): this very session closes when it answers. */
export async function requestAccountDeletion(jwt: string): Promise<DeletionOutcome> {
  const result = await api<{ deadline: string }>('/me/account-deletion', { jwt, body: { confirm: ACCOUNT_DELETION_CONFIRM_WORD } });
  return result.ok ? { ok: true, deadline: new Date(result.data.deadline) } : { ok: false, message: result.message };
}
