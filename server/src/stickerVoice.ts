import type { Router } from 'express';
import { Types } from 'mongoose';
import { canUseStickerVoice, stickerVoiceOf, voiceTextOf, MAX_VOICE_TEXT, type StickerVoiceId } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/** What agentes is asked to say: the space and the person count for its cap per space. */
export type VoiceSpeech = { text: string; voiceId: StickerVoiceId; spaceId: string; userId: string };
export type VoiceOutcome = { ok: true; audio: Buffer } | { ok: false; reason: 'unavailable' | 'limit' | 'refused' };
/** Speaks a phrase with a sticker voice (agentes → Voice Studio on José's machine) and returns the audio. */
export type StickerVoiceSpeaker = (speech: VoiceSpeech) => Promise<VoiceOutcome>;

/** Until agentes answers, there is no voice: the person reads that it is not available, nothing breaks. */
export const noStickerVoice: StickerVoiceSpeaker = async () => ({ ok: false, reason: 'unavailable' });

export type VoiceRefusal = { status: number; message: string };

const ONLY_ADMINS = 'Solo los admins del espacio pueden usar las voces.';
const REFUSALS: Record<Exclude<VoiceOutcome, { ok: true }>['reason'], VoiceRefusal> = {
  unavailable: { status: 503, message: 'La voz no está disponible ahora. Inténtalo más tarde.' },
  limit: { status: 429, message: 'Este espacio ya usó muchas voces por hoy. Prueba mañana.' },
  refused: { status: 400, message: 'No se pudo decir esa frase. Prueba con otra.' },
};

/** Whether the person is an active owner or admin of that space (Voice Studio is one machine: José 27/11 «solo admins»). */
async function isSpaceAdmin(spaceId: unknown, userId: Types.ObjectId): Promise<boolean> {
  if (typeof spaceId !== 'string' || !Types.ObjectId.isValid(spaceId)) return false;
  const membership = await WorkspaceMemberModel.findOne({ workspaceId: new Types.ObjectId(spaceId), userId, status: 'active' }, { role: 1 }).lean<{ role?: string } | null>();
  return canUseStickerVoice(membership?.role as Parameters<typeof canUseStickerVoice>[0]);
}

/** The phrase spoken by the voice, or why not. Checks the phrase and the admin BEFORE asking agentes. */
export async function spokenSoundOf(input: { voiceId: string; text: unknown; spaceId: unknown; userId: Types.ObjectId }, speak: StickerVoiceSpeaker): Promise<{ audio: Buffer } | VoiceRefusal> {
  const voice = stickerVoiceOf(input.voiceId);
  const text = voiceTextOf(input.text);
  if (!voice || !text) return { status: 400, message: `Escribe una frase de hasta ${MAX_VOICE_TEXT} caracteres y elige una voz.` };
  if (!(await isSpaceAdmin(input.spaceId, input.userId))) return { status: 403, message: ONLY_ADMINS };
  const outcome = await speak({ text, voiceId: voice.id, spaceId: String(input.spaceId), userId: String(input.userId) });
  return outcome.ok ? { audio: outcome.audio } : REFUSALS[outcome.reason];
}

/** «Escuchar»: the phrase in that voice before saving it (agentes caches it, so saving does not ask twice). */
export function stickerVoiceRoutes(router: Router, deps: { speak: StickerVoiceSpeaker }): void {
  router.post('/stickers/voice/preview', requireSession, asyncRoute(async (req, res) => {
    const spoken = await spokenSoundOf({ voiceId: String(req.body?.voice ?? ''), text: req.body?.text, spaceId: req.body?.spaceId, userId: req.session!.userId }, deps.speak);
    if ('status' in spoken) return void res.status(spoken.status).json({ message: spoken.message });
    res.set({ 'Content-Type': 'audio/mp4', 'Cache-Control': 'no-store' });
    res.send(spoken.audio);
  }));
}
