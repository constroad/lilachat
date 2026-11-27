import { MAX_VOICE_TEXT, stickerVoiceOf, voiceTextOf, type StickerVoiceId } from '@lilachat/shared';

/**
 * «Voz» on the APK (José 27/11, design sv-01): a phrase said by Valeria or Daniel, latino neutro, for an owner or
 * admin of the open space. Pure: the sheet draws it, the forms carry these fields.
 */
export type SpokenChoice = { kind: 'spoken'; voiceId: StickerVoiceId; text: string; spaceId: string };

/** The phrase and the space, next to `sound` in the form; nothing for any other sound. */
export function spokenFieldsOf(choice: { kind: string } | null): [string, string][] {
  if (choice?.kind !== 'spoken') return [];
  const spoken = choice as SpokenChoice;
  const text = voiceTextOf(spoken.text);
  return text ? [['voiceText', text], ['spaceId', spoken.spaceId]] : [];
}

/** Why the voice is not ready yet, or null. */
export function spokenBlocker(choice: SpokenChoice): string | null {
  return voiceTextOf(choice.text) ? null : `Escribe la frase de la voz (hasta ${MAX_VOICE_TEXT} caracteres).`;
}

export function spokenSummary(choice: SpokenChoice): { title: string; detail: string } {
  return { title: `Voz de ${stickerVoiceOf(choice.voiceId)?.label ?? 'Lilachat'}`, detail: choice.text.trim() || 'Falta la frase' };
}

/** Bytes this many at a time into `btoa`: a whole clip at once overflows the call's arguments. */
const BASE64_CHUNK = 0x8000;

/** The audio of «Escuchar» as base64, to write it to the cache and play it. */
export function audioBase64Of(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let start = 0; start < view.length; start += BASE64_CHUNK) binary += String.fromCharCode(...view.subarray(start, start + BASE64_CHUNK));
  return btoa(binary);
}
