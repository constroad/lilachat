import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api/client';
import { jsonCall } from '../api/jsonCall';
import { getSocket } from './socketClient';
import { mergeHidden } from './hiddenRows';

/**
 * «Eliminar para mí» (FL9): the message hides on this phone at once and the
 * others still see it, like WhatsApp. Since 13/11 (José deleted on one
 * computer and still saw it on the other) the server keeps each person's
 * list, so my other devices hide it too.
 */
const clave = (chatId: string) => `lilachat.ocultos.${chatId}`;
const hiddenUrl = (chatId: string) => `${BASE_URL}/api/chats/${chatId}/ocultos`;

export { mergeHidden, sinOcultos } from './hiddenRows';

async function readLocal(chatId: string): Promise<Set<number>> {
  const raw = await AsyncStorage.getItem(clave(chatId)).catch(() => null);
  const parsed = raw ? (JSON.parse(raw) as unknown) : [];
  return new Set(Array.isArray(parsed) ? parsed.filter((seq): seq is number => typeof seq === 'number') : []);
}

const writeLocal = (chatId: string, hidden: ReadonlySet<number>) => AsyncStorage.setItem(clave(chatId), JSON.stringify([...hidden])).catch(() => undefined);

/** Tells my other devices; offline it stays hidden here only. */
const pushHidden = (jwt: string, chatId: string, seqs: readonly number[]) => void jsonCall(hiddenUrl(chatId), jwt, { method: 'POST', body: JSON.stringify({ seqs }) });

export function useOcultos(chatId: string, jwt: string): { ocultos: ReadonlySet<number>; ocultar: (seq: number) => void } {
  const [ocultos, setOcultos] = useState<ReadonlySet<number>>(new Set());

  const absorb = useCallback(
    (seqs: readonly number[]) =>
      setOcultos((current) => {
        const next = mergeHidden(current, seqs);
        if (next !== current) void writeLocal(chatId, next);
        return next;
      }),
    [chatId]
  );

  useEffect(() => {
    let alive = true;
    void readLocal(chatId).then(async (local) => {
      if (!alive) return;
      setOcultos(local);
      const server = await jsonCall<{ seqs: number[] }>(hiddenUrl(chatId), jwt);
      if (alive && server.ok) absorb(server.data.seqs);
    });
    const socket = getSocket();
    const onHidden = (frame: { chatId: string; seqs: number[] }) => {
      if (alive && frame.chatId === chatId && Array.isArray(frame.seqs)) absorb(frame.seqs);
    };
    socket?.on('msg.hidden', onHidden);
    return () => {
      alive = false;
      socket?.off('msg.hidden', onHidden);
    };
  }, [chatId, jwt, absorb]);

  const ocultar = useCallback(
    (seq: number) => {
      absorb([seq]);
      pushHidden(jwt, chatId, [seq]);
    },
    [absorb, chatId, jwt]
  );

  return { ocultos, ocultar };
}

/** «Eliminar para mí» of many messages of one chat at once (pending 13, from «Almacenamiento»). */
export async function hideForMe(chatId: string, seqs: readonly number[], jwt: string): Promise<void> {
  const hidden = await readLocal(chatId);
  for (const seq of seqs) hidden.add(seq);
  await AsyncStorage.setItem(clave(chatId), JSON.stringify([...hidden]));
  pushHidden(jwt, chatId, seqs);
}
