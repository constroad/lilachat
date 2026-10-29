import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import type { LiveLocationMinutes, SharedLocation } from '@lilachat/shared';
import { shareLocation } from '../api/client';
import { useShareContact } from './contactCard/useShareContact';
import { ShareLocationSheet } from './location/ShareLocationSheet';
import { startLiveSharing } from './location/liveLocationTask';

/**
 * What the clip shares that is not a file (pending 9 and 11): a contact from
 * the phone book and the current location. Not in a secret chat, where these
 * messages would travel unsealed.
 */
export function useClipSharing(params: { jwt: string; chatId: string; encrypted: boolean; onError: (message: string) => void }) {
  const { jwt, chatId, encrypted, onError } = params;
  const shareContactFromClip = useShareContact({ jwt, chatId, onError });
  const [locating, setLocating] = useState(false);
  const send = useCallback(async (location: SharedLocation, liveMinutes?: LiveLocationMinutes) => {
    const sent = await shareLocation(jwt, chatId, { ...location, clientKey: Crypto.randomUUID(), ...(liveMinutes ? { liveMinutes } : {}) });
    if (!sent.ok) onError(sent.message ?? 'No se pudo compartir la ubicación.');
    const liveUntil = sent.ok ? sent.data.message.location?.liveUntil : undefined;
    if (sent.ok && liveUntil && !(await startLiveSharing({ chatId, seq: sent.data.message.seq, liveUntil }))) {
      onError('Se envió tu ubicación, pero el teléfono no pudo seguir compartiéndola.');
    }
    return sent.ok;
  }, [jwt, chatId, onError]);
  return {
    onShareContact: encrypted ? undefined : () => void shareContactFromClip(),
    onShareLocation: encrypted ? undefined : () => setLocating(true),
    sheet: <ShareLocationSheet visible={locating} onClose={() => setLocating(false)} onSend={send} />,
  };
}
