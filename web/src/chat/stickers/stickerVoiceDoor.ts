import { useMemo } from 'react';
import { canUseStickerVoice, type StickerVoiceId } from '@lilachat/shared';
import { useCurrentSpaceId, useMySpaces } from '../../spaces/currentSpace';
import { previewStickerVoice, type VoiceOutcome } from './stickersApi';

/** What «Voz» needs (José 27/11): the space it is asked from, and «Escuchar» before saving. */
export type StickerVoiceDoor = { spaceId: string; listen: (voiceId: StickerVoiceId, text: string) => Promise<VoiceOutcome> };

/** The voice door when I am an owner or admin of the open space; null for everyone else (José 27/11: «solo admins»). */
export function useStickerVoiceDoor(jwt: string): StickerVoiceDoor | null {
  const spaceId = useCurrentSpaceId();
  const { spaces } = useMySpaces(jwt);
  const role = spaces?.find((space) => space.id === spaceId)?.role;
  return useMemo(() => (spaceId && canUseStickerVoice(role) ? { spaceId, listen: (voiceId, text) => previewStickerVoice(jwt, { voiceId, text, spaceId }) } : null), [jwt, spaceId, role]);
}
