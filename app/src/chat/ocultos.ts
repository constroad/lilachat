import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * «Eliminar para mí» (FL9): el mensaje se oculta en ESTE teléfono y los demás
 * lo siguen viendo, como WhatsApp. Por chat, en el disco del teléfono.
 */
const clave = (chatId: string) => `lilachat.ocultos.${chatId}`;

export function sinOcultos<T extends { seq?: number }>(filas: T[], ocultos: ReadonlySet<number>): T[] {
  if (ocultos.size === 0) return filas;
  return filas.filter((fila) => typeof fila.seq !== 'number' || !ocultos.has(fila.seq));
}

export function useOcultos(chatId: string): { ocultos: ReadonlySet<number>; ocultar: (seq: number) => void } {
  const [ocultos, setOcultos] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    let vivo = true;
    void AsyncStorage.getItem(clave(chatId))
      .then((crudo) => {
        const lista = crudo ? (JSON.parse(crudo) as unknown) : [];
        if (vivo && Array.isArray(lista)) setOcultos(new Set(lista.filter((seq): seq is number => typeof seq === 'number')));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [chatId]);

  const ocultar = useCallback(
    (seq: number) => {
      setOcultos((actuales) => {
        const nuevos = new Set(actuales).add(seq);
        void AsyncStorage.setItem(clave(chatId), JSON.stringify([...nuevos])).catch(() => undefined);
        return nuevos;
      });
    },
    [chatId]
  );

  return { ocultos, ocultar };
}

/** «Eliminar para mí» of many messages of one chat at once (pending 13, from «Almacenamiento»). */
export async function hideForMe(chatId: string, seqs: readonly number[]): Promise<void> {
  const saved = await AsyncStorage.getItem(clave(chatId)).catch(() => null);
  const parsed = saved ? (JSON.parse(saved) as unknown) : [];
  const hidden = new Set(Array.isArray(parsed) ? parsed.filter((seq): seq is number => typeof seq === 'number') : []);
  for (const seq of seqs) hidden.add(seq);
  await AsyncStorage.setItem(clave(chatId), JSON.stringify([...hidden]));
}
