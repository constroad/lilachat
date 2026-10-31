import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { readAllChats } from '../api/client';

/**
 * «Marcar todo como leído» over the unread chats (R31/10-B9), like WhatsApp's
 * «Leer todo»: every chat of this list read to its end. The rows update by the
 * server's notice, like when a chat is read on another device.
 */
export function ReadAllRow(props: { jwt: string; workspaceId: string | null; onDone: () => void }) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const readAll = async () => {
    setBusy(true);
    const answer = await readAllChats(props.jwt, props.workspaceId);
    setBusy(false);
    setFailed(!answer.ok);
    if (answer.ok) props.onDone();
  };
  return (
    <Pressable testID="btn-leer-todo" accessibilityRole="button" disabled={busy} onPress={() => void readAll()} className="self-end px-5 py-2">
      <Text className={`text-[14px] font-semibold ${busy ? 'text-on-surface-variant' : failed ? 'text-error' : 'text-primary'}`}>{busy ? 'Marcando…' : failed ? 'No se pudo marcar. Reintenta' : 'Marcar todo como leído'}</Text>
    </Pressable>
  );
}
