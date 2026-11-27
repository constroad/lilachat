/**
 * A voice as a sticker's sound (José 27/11: Latin Spanish voices, admins only, only Valeria and Daniel).
 * The person writes a short phrase and picks a voice; agentes speaks it (Voice Studio, on José's machine)
 * and the server keeps the audio as the sticker's sound. Only a space owner or admin can use it.
 */
import { canManageMembers, type WorkspaceRole } from './workspaces.js';

export type StickerVoiceId = 'valeria' | 'daniel';
export type StickerVoice = { id: StickerVoiceId; label: string; detail: string };

/** Latin neutral voices only; never Lila's (Lucía), Lumi's (Mateo) or José's clone. */
export const STICKER_VOICES: readonly StickerVoice[] = [
  { id: 'valeria', label: 'Valeria', detail: 'Latino neutro · mujer' },
  { id: 'daniel', label: 'Daniel', detail: 'Latino neutro · hombre' },
];

/** The longest phrase agentes speaks for a sticker: it has to fit in 6 seconds. */
export const MAX_VOICE_TEXT = 120;

export function stickerVoiceOf(voiceId: string): StickerVoice | null {
  return STICKER_VOICES.find((voice) => voice.id === voiceId) ?? null;
}

/** Voice Studio is one machine: only a space owner or admin gets it. */
export function canUseStickerVoice(role: WorkspaceRole | null | undefined): boolean {
  return role ? canManageMembers(role) : false;
}

/** The phrase to speak, trimmed, or null when it is empty, too long or not text. */
export function voiceTextOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text.length > 0 && text.length <= MAX_VOICE_TEXT ? text : null;
}

/** The stored file's name says which voice it is, so the sticker can name it later. */
export function stickerVoiceFileName(voiceId: StickerVoiceId): string {
  return `sticker-voz-${voiceId}.m4a`;
}
