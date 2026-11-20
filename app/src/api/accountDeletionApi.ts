import { ACCOUNT_DELETION_CONFIRM_WORD } from '@lilachat/shared';
import { BASE_URL } from './client';
import { jsonCall } from './jsonCall';

export type DeletionOutcome = { ok: true; deadline: Date } | { ok: false; message: string };

/** `POST /api/me/account-deletion` (José 19/11): the session of this phone closes when it answers. */
export async function requestAccountDeletion(jwt: string): Promise<DeletionOutcome> {
  const result = await jsonCall<{ deadline: string }>(`${BASE_URL}/api/me/account-deletion`, jwt, { method: 'POST', body: JSON.stringify({ confirm: ACCOUNT_DELETION_CONFIRM_WORD }) });
  return result.ok ? { ok: true, deadline: new Date(result.data.deadline) } : { ok: false, message: result.message ?? 'No se pudo borrar. Inténtalo de nuevo.' };
}
