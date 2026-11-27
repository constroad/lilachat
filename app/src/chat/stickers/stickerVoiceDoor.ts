import { useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { canUseStickerVoice, type StickerVoiceId } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { useCurrentSpaceId, useMySpaces } from '../../spaces/currentSpace';
import { audioBase64Of } from './spokenVoice';

/** agentes waits 15 s for Voice Studio; the server 20 s. */
const PREVIEW_TIMEOUT_MS = 25_000;

/** The last «Escuchar» file: the next one replaces it, so the cache keeps one. */
let lastPreview: string | null = null;

export type HeardVoice = { ok: true; uri: string } | { ok: false; reason: string };
/** What «Voz» needs (José 27/11): the space it is asked from, and «Escuchar» before saving. */
export type StickerVoiceDoor = { spaceId: string; listen: (voiceId: StickerVoiceId, text: string) => Promise<HeardVoice> };

/** «Escuchar»: the phrase in that voice, kept in the cache to play it, or the server's refusal in its words. */
async function listenVoice(jwt: string, request: { voiceId: StickerVoiceId; text: string; spaceId: string }): Promise<HeardVoice> {
  try {
    const response = await fetch(`${BASE_URL}/api/stickers/voice/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: request.voiceId, text: request.text, spaceId: request.spaceId }),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      return { ok: false, reason: payload.message ?? 'La voz no está disponible ahora. Inténtalo más tarde.' };
    }
    const uri = `${FileSystem.cacheDirectory}sticker-voz-${request.voiceId}-${Date.now()}.m4a`;
    await FileSystem.writeAsStringAsync(uri, audioBase64Of(await response.arrayBuffer()), { encoding: FileSystem.EncodingType.Base64 });
    if (lastPreview) void FileSystem.deleteAsync(lastPreview, { idempotent: true }).catch(() => undefined);
    lastPreview = uri;
    return { ok: true, uri };
  } catch {
    return { ok: false, reason: 'La voz no está disponible ahora. Inténtalo más tarde.' };
  }
}

/** The voice door when I am an owner or admin of the open space; null for everyone else (José 27/11: «solo admins»). */
export function useStickerVoiceDoor(jwt: string): StickerVoiceDoor | null {
  const spaceId = useCurrentSpaceId();
  const { spaces } = useMySpaces(jwt);
  const role = spaces?.find((space) => space.id === spaceId)?.role;
  return useMemo(() => (spaceId && canUseStickerVoice(role) ? { spaceId, listen: (voiceId, text) => listenVoice(jwt, { voiceId, text, spaceId }) } : null), [jwt, spaceId, role]);
}
