import type { Types } from 'mongoose';
import { draftValues, formFields, previewReplyOf, type CommandScope, type FormValues, type PreviewReply } from '@lilachat/shared';
import { callBotWebhook } from './botEvents.js';
import { expectLateAnswer } from './lateAnswers.js';
import { commandAnswerTimeout, deliverResponse, judgeReply } from './botCommands.js';
import { formParty, openRun, type FormOutcome } from './botForms.js';
import { channelOf } from './botTriggers.js';

/**
 * A form that lives while it is filled (agentes 2483da7, 30/10: Wilson's fuel
 * consumption). `x-refresh`: a new period asks the app for the form again with
 * the draft, on the same command. `x-preview`: the app's read tool sums up the
 * draft above «Enviar»; if it fails or is slow there is no summary, never an error.
 */
const PREVIEW_TIMEOUT_MS = 3000;
const NO_SUMMARY: PreviewReply = { blocks: [], errors: {} };
const record = (value: unknown): FormValues => (value && typeof value === 'object' && !Array.isArray(value) ? (value as FormValues) : {});
/** Refused before the app hears anything: the route answers `status` with the message. */
type LiveError = { status: number; error: string; message: string };
const refused = (error: string, message: string): LiveError => ({ status: 409, error, message });

/** The same event that opened the form, now with the draft and `refresh: true`; the answer replaces the form in place. */
export async function refreshForm(userId: Types.ObjectId, scope: CommandScope, commandId: string, raw: unknown): Promise<FormOutcome | LiveError> {
  const run = await openRun(userId, scope, commandId);
  if ('error' in run) return run;
  const fields = formFields(run.form!);
  if (!fields.some((field) => field.refresh)) return refused('no_refresh', 'Este formulario no se actualiza solo.');
  const party = await formParty(run, commandId);
  if ('error' in party) return party;
  const { installation, chat, user, app, base } = party;
  const trigger = run.trigger ?? 'shortcut';
  const named = trigger === 'command' ? { command: run.command, text: run.text ?? '' } : { shortcut: run.command };
  const data = { command_id: commandId, channel: chat ? channelOf(chat) : null, user, ...named, values: draftValues(fields, record(raw)), refresh: true };
  // Open before calling: Portal can take longer than 1.5 s and the form then comes by /respond (agentes, 30/10).
  const late = expectLateAnswer(commandId);
  try {
    const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, `${trigger}.invoked`, data, commandAnswerTimeout());
    const judged = judgeReply(reply, run.command, installation._id, base);
    if ('accepted' in judged) return deliverResponse(installation, run, chat, judged.accepted, base);
    return judged.outcome === 'pending' ? ((await late.within()) ?? judged) : judged;
  } finally {
    late.cancel();
  }
}

/** The summary of the draft (`form.preview.requested`): the kit's blocks and a line per field, or nothing. */
export async function previewForm(userId: Types.ObjectId, scope: CommandScope, commandId: string, raw: unknown): Promise<PreviewReply | LiveError> {
  const run = await openRun(userId, scope, commandId);
  if ('error' in run) return run;
  if (!run.form!.preview) return refused('no_preview', 'Este formulario no tiene resumen.');
  const party = await formParty(run, commandId);
  if ('error' in party) return party;
  const { installation, chat, user, app } = party;
  const data = { command_id: commandId, form_id: run.form!.id, values: draftValues(formFields(run.form!), record(raw)), channel: chat ? channelOf(chat) : null, user };
  const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'form.preview.requested', data, PREVIEW_TIMEOUT_MS);
  return reply.status !== null && reply.status < 400 ? previewReplyOf(reply.body) : NO_SUMMARY;
}
