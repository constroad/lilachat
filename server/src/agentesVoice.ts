import { eventSignature } from './bots/botSecrets.js';
import { lilaDoorFor } from './agentesModel.js';
import type { StickerVoiceSpeaker, VoiceOutcome } from './stickerVoice.js';

/** agentes waits 15 s for Voice Studio before its own 503; a little more here so its answer arrives. */
const SPEECH_TIMEOUT_MS = 20_000;
const SPEECH_PATH = '/v1/voice/speech';

const reasonOf = (status: number): Exclude<VoiceOutcome, { ok: true }>['reason'] => (status === 429 ? 'limit' : status === 400 ? 'refused' : 'unavailable');

/**
 * The sticker voice (José 27/11) from agentes, `POST /v1/voice/speech` (agentes 871d7c9): signed like its events,
 * with the Lila installation `lilaDoorFor` picks, at the same host as that app's webhook. No key or URL of our own.
 */
export const speakWithAgentes: StickerVoiceSpeaker = async (speech) => {
  const door = await lilaDoorFor([speech.userId]);
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
