import { Router, type Request, type Response } from 'express';
import { normalizeEmail, profileMissing, validarNombreDePerfil, validateBirthday, type Birthday } from '@lilachat/shared';
import type { AuthClient } from './authClient.js';
import { announceJoin } from './joinNotice.js';
import { claimEmailInvites } from './workspaceEmailInvites.js';
import { crearLimiteDeIntentos } from './limiteDeIntentos.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { UserModel, type User } from './models.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * The profile Lilachat requires (José, 21/10; backlog 17): name and birthday,
 * besides the phone the sign-up code proved. The app and the web ask for what
 * `missing` says on a screen that cannot be skipped. The email is optional
 * since 22/10 (backlog 51) and needed only for the backup; it is proved like
 * the phone: a code from constroad-auth to that address.
 * Mounted on `/api/me`, next to the older `PUT /perfil` (the name in Ajustes).
 */
const EMAIL_CODES_PER_MINUTE = 5;
const ONE_MINUTE_MS = 60_000;
const DUPLICATE_KEY = 11000;

type ProfileUser = Pick<User, '_id' | 'name' | 'phone' | 'avatarUrl' | 'email' | 'emailVerifiedAt' | 'birthday' | 'birthdayVisible'>;
const PROFILE_FIELDS = 'name phone avatarUrl email emailVerifiedAt birthday birthdayVisible';

function profileView(user: ProfileUser) {
  const emailVerified = Boolean(user.email && user.emailVerifiedAt);
  return {
    name: user.name ?? null,
    phone: user.phone,
    avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null,
    email: user.email ?? null,
    emailVerified,
    birthday: user.birthday ?? null,
    birthdayVisible: user.birthdayVisible !== false,
    missing: profileMissing({ name: user.name, birthday: user.birthday }),
  };
}

/** What `PUT /profile` may change, validated; a message for the first wrong field. */
function changesOf(body: Record<string, unknown>): { ok: true; set: Record<string, unknown> } | { ok: false; message: string } {
  const set: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = validarNombreDePerfil(body.name);
    if (!name.ok) return { ok: false, message: name.motivo };
    set.name = name.nombre;
  }
  if (body.birthday !== undefined) {
    const birthday = validateBirthday(body.birthday);
    if (!birthday.ok) return birthday;
    set.birthday = birthday.birthday satisfies Birthday;
  }
  if (typeof body.birthdayVisible === 'boolean') set.birthdayVisible = body.birthdayVisible;
  return Object.keys(set).length ? { ok: true, set } : { ok: false, message: 'No hay nada que guardar.' };
}

async function emailTaken(email: string, userId: User['_id']): Promise<boolean> {
  return Boolean(await UserModel.exists({ email, emailVerifiedAt: { $exists: true }, _id: { $ne: userId } }));
}

export function buildProfileRouter(authClient: AuthClient): Router {
  const router = Router();
  const emailTries = crearLimiteDeIntentos({ maximo: EMAIL_CODES_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  router.use(requireSession);
  router.get('/profile', asyncRoute(async (req, res) => {
    const user = await UserModel.findById(req.session!.userId).select(PROFILE_FIELDS).lean<ProfileUser | null>();
    if (!user) return void res.status(404).json({ message: 'No encontramos tu usuario.' });
    res.json({ profile: profileView(user) });
  }));
  router.put('/profile', asyncRoute(async (req, res) => {
    const changes = changesOf((req.body ?? {}) as Record<string, unknown>);
    if (!changes.ok) return void res.status(400).json({ message: changes.message });
    const user = await UserModel.findByIdAndUpdate(req.session!.userId, { $set: changes.set }, { returnDocument: 'after' }).select(PROFILE_FIELDS).lean<ProfileUser | null>();
    if (!user) return void res.status(404).json({ message: 'No encontramos tu usuario.' });
    // A new account with its name now announces itself to who invited it (`joinNotice.ts`).
    void announceJoin(user._id).catch((error) => console.error('[se-unio] no se pudo avisar:', error instanceof Error ? error.message : error));
    res.json({ profile: profileView(user) });
  }));
  router.post('/email/code', asyncRoute(async (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return void res.status(400).json({ message: 'Ese correo no parece válido.' });
    if (!emailTries.permitir(String(req.session!.userId))) return void res.status(429).json({ message: 'Demasiados intentos. Espera un minuto.' });
    if (await emailTaken(email, req.session!.userId)) return void res.status(409).json({ message: 'Ese correo ya está en otra cuenta de Lilachat.' });
    const sent = await authClient.requestCode(email);
    if (!sent.ok) return void res.status(503).json({ message: 'No se pudo enviar el código. Inténtalo de nuevo.' });
    res.json({ sent: true });
  }));
  router.post('/email/verify', asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!email || !code) return void res.status(400).json({ message: 'Faltan el correo o el código.' });
    if (await emailTaken(email, req.session!.userId)) return void res.status(409).json({ message: 'Ese correo ya está en otra cuenta de Lilachat.' });
    const verified = await authClient.verifyCode(email, code, `correo-${req.session!.userId}`);
    if (!verified.ok) return void res.status(400).json({ message: 'El código no es correcto o venció.' });
    // Proving the code makes it yours: an older account that only held it unverified (an old admission) lets it go.
    await UserModel.updateMany({ email, _id: { $ne: req.session!.userId }, emailVerifiedAt: { $exists: false } }, { $unset: { email: 1 } });
    // A race with another verification hits the unique index: that is a 409, not a 500.
    const user = await UserModel.findByIdAndUpdate(req.session!.userId, { $set: { email, emailVerifiedAt: new Date() } }, { returnDocument: 'after' })
      .select(PROFILE_FIELDS)
      .lean<ProfileUser | null>()
      .catch((error: { code?: number }) => (error?.code === DUPLICATE_KEY ? 'taken' as const : Promise.reject(error)));
    if (user === 'taken') return void res.status(409).json({ message: 'Ese correo ya está en otra cuenta de Lilachat.' });
    if (!user) return void res.status(404).json({ message: 'No encontramos tu usuario.' });
    // Spaces that invited this email (22/10) admit the person now.
    await claimEmailInvites(user._id, email).catch((error) => console.error('[workspaces] no se pudieron reclamar invitaciones por correo:', error instanceof Error ? error.message : error));
    res.json({ profile: profileView(user) });
  }));
  return router;
}
