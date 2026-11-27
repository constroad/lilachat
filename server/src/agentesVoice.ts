import { Types } from 'mongoose';
import { eventSignature } from './bots/botSecrets.js';
import { BotInstallationModel } from './bots/botModels.js';
import { agentesApps } from './agentesModel.js';
import type { StickerVoiceSpeaker, VoiceOutcome } from './stickerVoice.js';

/** agentes waits 15 s for Voice Studio before its own 503; a little more here so its answer arrives. */
const SPEECH_TIMEOUT_MS = 20_000;
const SPEECH_PATH = '/v1/voice/speech';

const reasonOf = (status: number): Exclude<VoiceOutcome, { ok: true }>['reason'] => (status === 429 ? 'limit' : status === 400 ? 'refused' : 'unavailable');

type VoiceDoor = { _id: Types.ObjectId; signingSecret: string; webhookUrl: string };

/**
 * Who signs the voice ask: a live installation, in that space, of any app agentes hosts (agentes 27/11: any live
 * installation of one of its apps). Agentes' host is the one of its developer app (Lila); in production Lila
 * itself had no installation, while Dali, Portal and Inframaq did.
 */
async function agentesDoorFor(spaceId: string): Promise<VoiceDoor | null> {
  if (!Types.ObjectId.isValid(spaceId)) return null;
  const apps = await agentesApps();
  const installation = await BotInstallationModel.findOne({ appId: { $in: apps.map((app) => app._id) }, workspaceId: new Types.ObjectId(spaceId), revokedAt: { $exists: false } })
    .select('_id signingSecret appId')
    .lean();
  const app = installation ? apps.find((one) => String(one._id) === String(installation.appId)) : undefined;
  return installation && app?.webhookUrl ? { _id: installation._id, signingSecret: installation.signingSecret, webhookUrl: app.webhookUrl } : null;
}

/**
 * The sticker voice (José 27/11) from agentes, `POST /v1/voice/speech` (agentes 871d7c9): signed like its events, with
 * the space's installation of an agentes app (`agentesDoorFor`), at that app's host. No key or URL of our own.
 */
export const speakWithAgentes: StickerVoiceSpeaker = async (speech) => {
  const door = await agentesDoorFor(speech.spaceId);
  if (!door) return { ok: false, reason: 'unavailable' };
  const body = JSON.stringify({ text: speech.text, voice: speech.voiceId, spaceId: speech.spaceId, userId: speech.userId });
  const timestamp = Date.now();
  try {
    const response = await fetch(new URL(SPEECH_PATH, door.webhookUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-lilachat-installation': String(door._id), 'x-lilachat-timestamp': String(timestamp), 'x-lilachat-signature': eventSignature(door.signingSecret, timestamp, body) },
      body,
      signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: reasonOf(response.status) };
    const audio = Buffer.from(await response.arrayBuffer());
    return audio.length > 0 ? { ok: true, audio } : { ok: false, reason: 'unavailable' };
  } catch (error) {
    console.error(`[voice] agentes did not answer: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, reason: 'unavailable' };
  }
};
