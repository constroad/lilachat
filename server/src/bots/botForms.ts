import { createHmac, timingSafeEqual } from 'node:crypto';
import mongoose, { Types, type Model } from 'mongoose';
import { formFields, isAckBody, photoStampLines, validateFormReply, validateFormValues, type CommandOutcome, type CommandScope, type FormField, type FormValues, type GeoPoint } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import type { UploadOutcome } from '../mediaClient.js';
import { readOwnMedia, ownMediaBase } from '../mediaDisk.js';
import { defaultMediaUploader } from '../localMediaUploader.js';
import { resolveJwtSecret } from '../sessions.js';
import { callBotWebhook, isRestarting, recordLastDelivery } from './botEvents.js';
import { expectLateAnswer } from './lateAnswers.js';
import { commandAnswerTimeout, deliverResponse, recordRunFailure, restartingMessage, type Base, type ChatOfCommand, type CommandError } from './botCommands.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel } from './botModels.js';
import { channelOf, personOf } from './botTriggers.js';
import { shrinkPhoto, stampPhoto } from './photoStamp.js';

/**
 * App forms (R160, `specs/BOTS-API.spec.md` §c-ter; José, 23/10: mark
 * attendance with a selfie and the GPS, register material, measure a tank).
 * The app answered a command with a form; the person's photo goes to Lilachat
 * first and the app gets a signed address valid 15 minutes, on one fixed host
 * (Inframaq allows only that host, against SSRF). Sending the form is the
 * person's confirmation: the app hears `form.submitted`.
 */
export type FormFile = { _id: Types.ObjectId; runId: Types.ObjectId; userId: Types.ObjectId; url: string; mime: string; size: number; createdAt: Date };
const fileSchema = new mongoose.Schema<FormFile>(
  {
    runId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    url: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// The record goes after a day; the address only lives 15 minutes anyway.
fileSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
export const FormFileModel: Model<FormFile> = (mongoose.models.FormFile as Model<FormFile>) ?? mongoose.model<FormFile>('FormFile', fileSchema);

const SIGNED_TTL_MS = 15 * 60_000;
/** The photos a form takes (agentes: JPEG, PNG, WEBP or HEIC, up to 10 MB). */
export const FORM_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const FORM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const isId = (value: unknown): value is string => typeof value === 'string' && Types.ObjectId.isValid(value);
const fail = (status: CommandError['status'] | 422, error: string, message: string) => ({ status, error, message });

type Upload = (params: { chatId: string; fileName: string; mimeType: string; bytes: Buffer }) => Promise<UploadOutcome>;
let upload: Upload = (params) => defaultMediaUploader().upload({ ...params, kind: 'image' });
let read: (url: string) => Promise<Buffer | null> = readOwnMedia;

/** Tests keep the photos in memory. */
export function configureFormFiles(deps: { upload?: Upload; read?: (url: string) => Promise<Buffer | null> }): void {
  if (deps.upload) upload = deps.upload;
  if (deps.read) read = deps.read;
}

const signingKey = () => createHmac('sha256', resolveJwtSecret()).update('lilachat:bot-files').digest();
const signatureOf = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

/** `https://<host>/api/bots/files/<payload>.<signature>`, valid 15 minutes. */
export function signedFileUrl(fileId: Types.ObjectId | string, now = Date.now()): string {
  const payload = Buffer.from(`${fileId}:${now + SIGNED_TTL_MS}`).toString('base64url');
  return `${ownMediaBase()}/api/bots/files/${payload}.${signatureOf(payload)}`;
}

/** The file behind a signed address: 404 for a bad one, 410 once it expired. */
export async function readSignedFile(token: string): Promise<{ bytes: Buffer; mime: string } | { status: 404 | 410 }> {
  const [payload = '', signature = ''] = token.split('.');
  const expected = signatureOf(payload);
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { status: 404 };
  const [fileId, expires] = Buffer.from(payload, 'base64url').toString('utf8').split(':');
  if (!isId(fileId)) return { status: 404 };
  if (Number(expires) < Date.now()) return { status: 410 };
  const file = await FormFileModel.findById(fileId).lean();
  const bytes = file ? await read(file.url) : null;
  return file && bytes ? { bytes, mime: file.mime } : { status: 404 };
}

/** The asker's open form, or why not: in its chat, or in the space when it came from the ⚡. */
async function openRun(userId: Types.ObjectId, scope: CommandScope, commandId: string) {
  const where = 'chatId' in scope ? (isId(scope.chatId) ? { chatId: scope.chatId } : null) : isId(scope.workspaceId) ? { workspaceId: scope.workspaceId, chatId: { $exists: false } } : null;
  if (!where || !isId(commandId)) return fail(404, 'command_not_found', 'Ese formulario no existe.');
  const run = await BotCommandRunModel.findOne({ _id: commandId, userId, ...where }).lean();
  if (!run) return fail(404, 'command_not_found', 'Ese formulario no existe o no es tuyo.');
  if (run.expiresAt.getTime() <= Date.now()) return fail(410, 'command_expired', 'Pasaron más de 15 minutos: vuelve a abrir el formulario.');
  if (!run.form) return fail(409, 'no_form', 'Ese comando no pidió un formulario.');
  return run;
}

/** The live selfie (pending 94): the server burns ITS hour and the place into it; a photo it cannot read goes as it came. */
async function stamped(file: { originalname: string; mimetype: string; buffer: Buffer }, location: GeoPoint | undefined): Promise<{ fileName: string; mimeType: string; bytes: Buffer }> {
  try {
    const bytes = await stampPhoto(file.buffer, photoStampLines({ at: new Date(), ...(location ? { location } : {}) }));
    return { fileName: file.originalname.replace(/\.\w+$/, '') + '.jpg', mimeType: 'image/jpeg', bytes };
  } catch (error) {
    console.error('[bots] no se pudo sellar la foto, va sin sello:', error instanceof Error ? error.message : error);
    return { fileName: file.originalname, mimeType: file.mimetype, bytes: file.buffer };
  }
}

/** Smaller before it is kept; a file sharp cannot read goes as it came, the photo is not lost. */
async function shrunk(file: { originalname: string; mimetype: string; buffer: Buffer }): Promise<{ fileName: string; mimeType: string; bytes: Buffer }> {
  try {
    return { fileName: file.originalname.replace(/\.[^.]+$/, '') + '.jpg', mimeType: 'image/jpeg', bytes: await shrinkPhoto(file.buffer) };
  } catch (error) {
    console.warn('[forms] foto sin reducir:', error instanceof Error ? error.message : error);
    return { fileName: file.originalname, mimeType: file.mimetype, bytes: file.buffer };
  }
}

export async function storeFormPhoto(userId: Types.ObjectId, scope: CommandScope, commandId: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, stamp?: { location?: GeoPoint }): Promise<{ fileId: string } | ReturnType<typeof fail>> {
  const run = await openRun(userId, scope, commandId);
  if ('error' in run) return run;
  if (!FORM_PHOTO_TYPES.includes(file.mimetype) || file.size > FORM_PHOTO_MAX_BYTES) return fail(400, 'invalid_photo', 'La foto va en JPEG, PNG, WEBP o HEIC, hasta 10 MB.');
  const photo = stamp ? await stamped(file, stamp.location) : await shrunk(file);
  // The media folder is the chat's, or the space's for the ⚡.
  const uploaded = await upload({ chatId: String(run.chatId ?? run.workspaceId), ...photo });
  if (!uploaded.ok) return fail(409, 'upload_failed', 'No se pudo guardar la foto. Inténtalo de nuevo.');
  const stored = await FormFileModel.create({ runId: run._id, userId, url: uploaded.media.url, mime: photo.mimeType, size: photo.bytes.length });
  return { fileId: String(stored._id) };
}

/** A photo field carries the id of a photo of THIS form; it goes to the app as its signed address. */
async function withSignedPhotos(runId: Types.ObjectId, fields: readonly FormField[], raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const values = { ...raw };
  const signed = async (fileId: unknown) => (isId(fileId) && (await FormFileModel.exists({ _id: fileId, runId })) ? signedFileUrl(String(fileId)) : null);
  for (const field of fields) {
    const raw = values[field.name];
    // A list's items (28/10): each item's photos signed the same way.
    if (field.kind === 'list') {
      if (Array.isArray(raw)) values[field.name] = await Promise.all(raw.map((item) => (item && typeof item === 'object' ? withSignedPhotos(runId, field.fields, item as Record<string, unknown>) : item)));
      continue;
    }
    if (field.kind !== 'photo') continue;
    // A list of photos (José, 24/10): each one signed; one that is not this form's is dropped.
    const urls = Array.isArray(raw) ? (await Promise.all(raw.map(signed))).filter((url): url is string => url !== null) : null;
    const url = urls ? null : await signed(raw);
    if (urls) values[field.name] = urls;
    else if (url) values[field.name] = url;
    else delete values[field.name];
  }
  return values;
}

export type FormOutcome = CommandOutcome | { status: 422; errors: Record<string, string> };

export async function submitForm(userId: Types.ObjectId, scope: CommandScope, commandId: string, raw: unknown): Promise<FormOutcome | ReturnType<typeof fail>> {
  const run = await openRun(userId, scope, commandId);
  if ('error' in run) return run;
  const fields = formFields(run.form!);
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const values = await withSignedPhotos(run._id, fields, input);
  // A signing takes the place of NOW (José, 24/10): a reading the phone kept is refused.
  const checked = validateFormValues(fields, values, { requireFresh: true });
  if (!checked.ok) return { status: 422, errors: checked.errors };
  const [installation, chat] = await Promise.all([
    BotInstallationModel.findOne({ _id: run.installationId, revokedAt: { $exists: false } }).lean(),
    run.chatId ? ChatModel.findById(run.chatId).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>() : null,
  ]);
  const user = await personOf(userId, installation?.grantedScopes);
  const app = installation ? await BotAppModel.findById(installation.appId).select('name webhookUrl').lean() : null;
  if (!installation || !app || (run.chatId && !chat)) return fail(410, 'app_uninstalled', 'La app ya no está instalada en este espacio.');
  const base: Base = { commandId, appId: String(app._id), appName: app.name };
  // Open before calling the app: its late answer can land before the webhook returns.
  const late = expectLateAnswer(commandId);
  try {
    const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'form.submitted', { form_id: run.form!.id, command_id: commandId, values: checked.values as FormValues, channel: chat ? channelOf(chat) : null, user }, commandAnswerTimeout());
    const outcome = await answerOf(reply, { installation, run, chat, base });
    return 'outcome' in outcome && outcome.outcome === 'pending' ? ((await late.within()) ?? outcome) : outcome;
  } finally {
    late.cancel();
  }
}

/** What the app said: its errors keep the form open; a slow or empty answer leaves it «enviando» until `/respond`. */
async function answerOf(reply: Awaited<ReturnType<typeof callBotWebhook>>, ctx: { installation: Parameters<typeof deliverResponse>[0]; run: Parameters<typeof deliverResponse>[1]; chat: ChatOfCommand | null; base: Base }): Promise<FormOutcome> {
  // A timeout, or a body that only acknowledges: the answer comes by /respond.
  if (reply.error === 'timeout' || (reply.status !== null && reply.status < 400 && isAckBody(reply.body))) return { ...ctx.base, outcome: 'pending' };
  const judged = reply.status !== null && reply.status < 400 ? validateFormReply(reply.body) : { ok: false as const, message: reply.error ?? 'Sin respuesta' };
  recordLastDelivery(ctx.installation._id, judged.ok ? { ok: true } : { ok: false, error: `form.submitted: ${judged.message}` });
  if (!judged.ok) {
    recordRunFailure(ctx.base.commandId, `form.submitted: ${judged.message}`);
    return { ...ctx.base, outcome: 'failed', message: isRestarting(reply) ? restartingMessage(ctx.base.appName) : `${ctx.base.appName} no pudo responder.` };
  }
  if ('errors' in judged) return { status: 422, errors: judged.errors };
  await BotCommandRunModel.updateOne({ _id: ctx.run._id }, { $inc: { responses: 1 }, $unset: { form: 1 } });
  return deliverResponse(ctx.installation, ctx.run, ctx.chat, judged.response, ctx.base);
}
