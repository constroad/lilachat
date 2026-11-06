/** Sent again after this long even if unchanged, in case the server lost its row. */
export const PUSH_TOKEN_RESEND_MS = 6 * 3_600_000;

const MINUTE_MS = 60_000;

export type SentPushToken = { token: string; jwt: string; at: number };

export type PushStatus =
  | { kind: 'sent' | 'denied' | 'failed'; at: number }
  | { kind: 'refused'; at: number; status: number };

/** Each return to the app asks; only a new token, a new session or the wait being over reaches the server. */
export function pushTokenSendDue(last: SentPushToken | null, token: string, jwt: string, now: number): boolean {
  return !last || last.token !== token || last.jwt !== jwt || now - last.at >= PUSH_TOKEN_RESEND_MS;
}

/** The registration in one line of Diagnóstico: a mute phone says why without reading the database. */
export function pushStatusLine(status: PushStatus | null, now: number): string {
  if (!status) return 'Avisos: sin registrar todavía';
  if (status.kind === 'sent') return `Avisos: registrados hace ${Math.round((now - status.at) / MINUTE_MS)} min`;
  if (status.kind === 'denied') return 'Avisos: sin permiso en este teléfono';
  if (status.kind === 'refused') return `Avisos: el server no aceptó el registro (${status.status})`;
  return 'Avisos: no se pudo registrar';
}
