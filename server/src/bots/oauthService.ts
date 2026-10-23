import { Types } from 'mongoose';
import { canManageMembers } from '@lilachat/shared';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { isAvailableIn } from './botAvailability.js';
import { installApp } from './botInstall.js';
import { BotAppModel, OAuthCodeModel, type BotApp } from './botModels.js';
import { newSecret, pkceMatches, sameHash, sha256 } from './botSecrets.js';

/**
 * OAuth 2.0 with code and PKCE for installing an app (`specs/BOTS-API.spec.md`
 * §a). The consent page asks `appForConsent`, the person approves with
 * `authorize`, and agentes trades the code with `exchangeCode`, server to
 * server. The code lives 10 minutes and works once; a redirect URI is never
 * one the app did not register, letter by letter.
 */
const CODE_TTL_MS = 10 * 60_000;
const STATE_MIN = 16;
export type OAuthError = { status: 400 | 401 | 403 | 404; error: string; error_description: string };
const oauthError = (status: OAuthError['status'], error: string, description: string): OAuthError => ({ status, error, error_description: description });

async function registeredApp(clientId: unknown, redirectUri: unknown): Promise<BotApp | OAuthError> {
  const app = typeof clientId === 'string' ? await BotAppModel.findOne({ clientId }).lean<BotApp | null>() : null;
  if (!app) return oauthError(400, 'invalid_client', 'Esa app no está registrada en Lilachat.');
  if (typeof redirectUri !== 'string' || !app.redirectUris.includes(redirectUri)) return oauthError(400, 'invalid_request', 'La dirección de vuelta no es la que registró la app.');
  return app;
}

/** The spaces where this person can install this app: theirs or where they are admin, and where the app is available (§0-ter). */
async function spacesToInstallIn(userId: Types.ObjectId, app: Pick<BotApp, 'availableIn'>): Promise<{ id: string; name: string; logoUrl?: string }[]> {
  const memberships = await WorkspaceMemberModel.find({ userId, status: 'active' }).select('workspaceId role').lean();
  const allowed = memberships.filter((member) => canManageMembers(member.role) && isAvailableIn(app, member.workspaceId)).map((member) => member.workspaceId);
  const spaces = await WorkspaceModel.find({ _id: { $in: allowed } }).select('name logoUrl').sort({ name: 1 }).lean();
  return spaces.map((space) => ({ id: String(space._id), name: space.name, ...(space.logoUrl ? { logoUrl: space.logoUrl } : {}) }));
}

export async function appForConsent(userId: Types.ObjectId, query: { client_id?: unknown; redirect_uri?: unknown }) {
  const app = await registeredApp(query.client_id, query.redirect_uri);
  if ('error' in app) return app;
  return { app: { name: app.name, ...(app.avatarUrl ? { avatarUrl: app.avatarUrl } : {}) }, spaces: await spacesToInstallIn(userId, app) };
}

const withQuery = (base: string, params: Record<string, string>) => {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
};

export async function authorize(userId: Types.ObjectId, body: Record<string, unknown>): Promise<{ redirect: string } | OAuthError> {
  const app = await registeredApp(body.client_id, body.redirect_uri);
  if ('error' in app) return app;
  const redirectUri = String(body.redirect_uri);
  const state = typeof body.state === 'string' ? body.state : '';
  if (state.length < STATE_MIN) return oauthError(400, 'invalid_request', 'Falta el state (al menos 16 caracteres).');
  if (body.decision !== 'approve') return { redirect: withQuery(redirectUri, { error: 'access_denied', state }) };
  const challenge = typeof body.code_challenge === 'string' ? body.code_challenge : '';
  if (body.code_challenge_method !== 'S256' || !challenge) return oauthError(400, 'invalid_request', 'Se necesita PKCE con S256.');
  const spaceId = typeof body.space_id === 'string' && Types.ObjectId.isValid(body.space_id) ? new Types.ObjectId(body.space_id) : null;
  const member = spaceId ? await WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId, status: 'active' }).select('role').lean() : null;
  if (!spaceId || !member || !canManageMembers(member.role)) return oauthError(403, 'access_denied', 'Solo el dueño o un admin del espacio instala apps.');
  if (!isAvailableIn(app, spaceId)) return oauthError(403, 'app_not_available', 'Esta app no está disponible para este espacio.');
  const code = newSecret('lco_');
  await OAuthCodeModel.create({ codeHash: sha256(code), appId: app._id, workspaceId: spaceId, userId, redirectUri, codeChallenge: challenge, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return { redirect: withQuery(redirectUri, { code, state }) };
}

export async function authenticatedClient(clientId: unknown, clientSecret: unknown): Promise<BotApp | null> {
  const app = typeof clientId === 'string' ? await BotAppModel.findOne({ clientId }).lean<BotApp | null>() : null;
  if (!app || typeof clientSecret !== 'string') return null;
  return sameHash(sha256(clientSecret), app.clientSecretHash) ? app : null;
}

export async function exchangeCode(body: Record<string, unknown>) {
  if (body.grant_type !== 'authorization_code') return oauthError(400, 'unsupported_grant_type', 'Solo authorization_code.');
  const app = await authenticatedClient(body.client_id, body.client_secret);
  if (!app) return oauthError(401, 'invalid_client', 'client_id o client_secret no coinciden.');
  const code = typeof body.code === 'string' ? body.code : '';
  // Used once: whoever marks it first takes it; a replay finds it used.
  const grant = await OAuthCodeModel.findOneAndUpdate({ codeHash: sha256(code), appId: app._id, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } }).lean();
  if (!grant || grant.expiresAt.getTime() < Date.now()) return oauthError(400, 'invalid_grant', 'El código no existe, venció o ya se usó.');
  if (grant.redirectUri !== body.redirect_uri) return oauthError(400, 'invalid_grant', 'La dirección de vuelta no es la del código.');
  if (typeof body.code_verifier !== 'string' || !pkceMatches(body.code_verifier, grant.codeChallenge)) return oauthError(400, 'invalid_grant', 'El code_verifier no coincide.');
  const space = await WorkspaceModel.findById(grant.workspaceId).select('name').lean();
  if (!space) return oauthError(400, 'invalid_grant', 'Ese espacio ya no existe.');
  const installed = await installApp({ app, workspaceId: grant.workspaceId, installedBy: grant.userId });
  return {
    access_token: installed.token,
    token_type: 'Bearer',
    installation_id: String(installed.installation._id),
    space: { id: String(space._id), name: space.name },
    bot_user_id: String(installed.installation.botUserId),
    signing_secret: installed.signingSecret,
  };
}
