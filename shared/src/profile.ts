/**
 * What a Lilachat profile must have (José, 21/10; backlog 17): a name and a
 * birthday (the year is optional), besides the phone the code already proved.
 * The email is optional (José, 22/10; backlog 51: someone who proved their
 * number should not be forced to prove an email too); it is required only to
 * turn on the backup (`backupNeedsEmail`). PURE: the server validates with
 * this and the app and the web ask for what `profileMissing` says.
 */
export type Birthday = { day: number; month: number; year?: number };
export type ProfileField = 'name' | 'birthday';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const OLDEST_YEAR = 1900;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_MAX = 120;

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
/** Without a year, February 29 is allowed: it exists in some years. */
const daysIn = (month: number, year?: number) => (month === 2 ? (year === undefined || isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31);

export function validateBirthday(raw: unknown, now: Date = new Date()): { ok: true; birthday: Birthday } | { ok: false; message: string } {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const day = Number(value.day);
  const month = Number(value.month);
  const year = value.year === undefined || value.year === null || value.year === '' ? undefined : Number(value.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, message: 'Elige el mes de tu cumpleaños.' };
  if (year !== undefined && (!Number.isInteger(year) || year < OLDEST_YEAR || year > now.getFullYear())) return { ok: false, message: 'Ese año no parece correcto.' };
  if (!Number.isInteger(day) || day < 1 || day > daysIn(month, year)) return { ok: false, message: 'Ese día no existe en ese mes.' };
  return { ok: true, birthday: { day, month, ...(year !== undefined ? { year } : {}) } };
}

/** Trimmed and lowercased; '' when it does not look like an email. */
export function normalizeEmail(raw: unknown): string {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return email.length <= EMAIL_MAX && EMAIL.test(email) ? email : '';
}

export function profileMissing(profile: { name?: string | null; birthday?: Birthday | null }): ProfileField[] {
  return [...(profile.name?.trim() ? [] : ['name' as const]), ...(profile.birthday ? [] : ['birthday' as const])];
}

/** The backup is the one thing that asks for a verified email: it is where the account is reached to get its copy back. */
export const backupNeedsEmail = (profile: { emailVerified: boolean }): boolean => !profile.emailVerified;

/** «29 de agosto». */
export const birthdayLabel = (birthday: Pick<Birthday, 'day' | 'month'>): string => `${birthday.day} de ${MONTHS[birthday.month - 1]}`;

/** My profile as `GET /api/me/profile` returns it. */
export type MyProfile = {
  name: string | null;
  phone: string;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  birthday: Birthday | null;
  birthdayVisible: boolean;
  missing: ProfileField[];
};

/** «Completa tu perfil»'s three birthday boxes, as typed (the year may stay empty). */
export function birthdayFromFields(fields: { day: string; month: string; year: string }, now: Date = new Date()): { ok: true; birthday: Birthday } | { ok: false; message: string } {
  if (!fields.day.trim() || !fields.month.trim()) return { ok: false, message: 'Escribe el día y el mes de tu cumpleaños.' };
  return validateBirthday({ day: Number(fields.day), month: Number(fields.month), ...(fields.year.trim() ? { year: Number(fields.year) } : {}) }, now);
}

/** The error to show under the birthday: only once day and month are typed, never for boxes still empty. */
export function birthdayFieldError(fields: { day: string; month: string; year: string }, now: Date = new Date()): string | null {
  if (!fields.day.trim() || !fields.month.trim()) return null;
  const birthday = birthdayFromFields(fields, now);
  return birthday.ok ? null : birthday.message;
}

/** «Continuar» needs a name and a valid birthday; the email is optional (backlog 51). */
export const canFinishProfile = (state: { name: string; birthdayOk: boolean }): boolean => Boolean(state.name.trim()) && state.birthdayOk;

/**
 * Whether «Completa tu perfil» covers the app (22/10). The check used to run
 * after the chats showed: they flashed and the form jumped in. Now someone
 * this device already saw complete opens at once (checked again behind), and
 * anyone else waits for the server's answer before seeing anything.
 */
export type ProfileGateState = { status: 'checking' } | { status: 'open' } | { status: 'blocked'; profile: MyProfile };

/** A slow server does not hold the app: after this, it opens and the answer can still block it. */
export const PROFILE_CHECK_LIMIT_MS = 5_000;

/**
 * What covers the app right now. The server's answer, when there is one;
 * before it, open for someone this device saw complete, for a session with
 * no network (no token to ask with) or once the limit passed; else waiting.
 */
export function profileGateNow(input: { answer: ProfileGateState | null; knownComplete: boolean; offline: boolean; gaveUp: boolean }): ProfileGateState {
  if (input.answer) return input.answer;
  return input.knownComplete || input.offline || input.gaveUp ? { status: 'open' } : { status: 'checking' };
}

/** Only a server that says something is missing blocks; no answer, or an older server without `profile`, opens. */
export function profileGateAfter(answer: { ok: true; profile?: MyProfile } | { ok: false }): ProfileGateState {
  return answer.ok && answer.profile?.missing?.length ? { status: 'blocked', profile: answer.profile } : { status: 'open' };
}

/** Where the device remembers that this person completed it. */
export const profileCompleteKey = (userId: string): string => `lilachat.profile-complete.${userId}`;
