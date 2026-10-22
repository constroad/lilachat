import { useCallback } from 'react';
import * as Contacts from 'expo-contacts/legacy';
import * as Crypto from 'expo-crypto';
import { shareContact } from '../../api/client';
import { pickContactNumber } from './pickNumber';

/**
 * «Contacto» in the clip (pending 9, José 20/10): the phone's own contact
 * picker (it needs no permission of ours), then the card goes to the chat.
 * The message arrives through the socket like any other.
 */
export function useShareContact(params: { jwt: string; chatId: string; onError: (message: string) => void }) {
  const { jwt, chatId, onError } = params;
  return useCallback(async () => {
    const picked = await Contacts.presentContactPickerAsync().catch(() => null);
    if (!picked) return;
    const phone = pickContactNumber(picked.phoneNumbers);
    if (!phone) return onError('Ese contacto no tiene un teléfono.');
    const sent = await shareContact(jwt, chatId, { name: picked.name ?? phone, phone, clientKey: Crypto.randomUUID() });
    if (!sent.ok) onError(sent.message ?? 'No se pudo compartir el contacto.');
  }, [jwt, chatId, onError]);
}
